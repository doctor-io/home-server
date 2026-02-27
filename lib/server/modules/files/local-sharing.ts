import "server-only";

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  deleteLocalShareFromDb,
  getLocalShareByShareNameFromDb,
  getLocalShareBySourcePathFromDb,
  getLocalShareFromDb,
  insertLocalShareInDb,
  listLocalSharesFromDb,
  type LocalShareRecord,
} from "@/lib/server/modules/files/local-shares-repository";
import {
  FilesPathError,
  resolvePathWithinFilesRoot,
} from "@/lib/server/modules/files/path-resolver";
import type {
  CreateLocalFolderShareRequest,
  FileServiceErrorCode,
  LocalFolderShareStatus,
} from "@/lib/shared/contracts/files";

const execFileAsync = promisify(execFile);

export class LocalSharingError extends Error {
  readonly code: FileServiceErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      code?: FileServiceErrorCode;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });
    this.name = "LocalSharingError";
    this.code = options?.code ?? "internal_error";
    this.statusCode = options?.statusCode ?? 500;
  }
}

function sanitizeShareName(input: string, fallback: string) {
  const sanitized = input
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 48);
  if (sanitized.length > 0) {
    return sanitized;
  }

  const fallbackSanitized = fallback
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 48);
  return fallbackSanitized.length > 0 ? fallbackSanitized : "shared-folder";
}

async function runCommand(command: string, args: string[]) {
  const result = await execFileAsync(command, args, {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  return typeof result === "string"
    ? {
        stdout: result,
        stderr: "",
      }
    : {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
}

async function isMountPoint(absolutePath: string) {
  try {
    await runCommand("mountpoint", ["-q", absolutePath]);
    return true;
  } catch {
    return false;
  }
}

async function isUsersharePresent(shareName: string) {
  try {
    await runCommand("net", ["usershare", "info", shareName]);
    return true;
  } catch {
    return false;
  }
}

function toShareStatus(
  record: LocalShareRecord,
  state: { isMounted: boolean; isExported: boolean },
): LocalFolderShareStatus {
  return {
    id: record.id,
    shareName: record.shareName,
    sourcePath: record.sourcePath,
    sharedPath: record.sharedPath,
    isMounted: state.isMounted,
    isExported: state.isExported,
  };
}

function mapFsError(error: unknown, fallbackMessage: string) {
  if (error instanceof LocalSharingError) return error;
  if (error instanceof FilesPathError) {
    return new LocalSharingError(error.message, {
      code: error.code,
      statusCode: error.statusCode,
      cause: error,
    });
  }

  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError?.code === "ENOENT") {
    return new LocalSharingError("File or directory not found", {
      code: "not_found",
      statusCode: 404,
      cause: error,
    });
  }
  if (nodeError?.code === "EACCES" || nodeError?.code === "EPERM") {
    const deniedPath =
      typeof nodeError.path === "string" ? nodeError.path : undefined;
    return new LocalSharingError(
      `Permission denied${deniedPath ? `: ${deniedPath}` : ""}`,
      {
        code: "mount_failed",
        statusCode: 403,
        cause: error,
      },
    );
  }

  return new LocalSharingError(fallbackMessage, {
    code: "internal_error",
    statusCode: 500,
    cause: error,
  });
}

async function ensureSharedRoot() {
  const resolved = await resolvePathWithinFilesRoot({
    inputPath: "Shared",
    requiredPrefix: "Shared",
    allowHiddenSegments: false,
    allowMissingLeaf: true,
  });
  await mkdir(resolved.absolutePath, {
    recursive: true,
  });
  return resolved;
}

async function resolveSourcePath(pathInput: string) {
  const resolved = await resolvePathWithinFilesRoot({
    inputPath: pathInput,
    allowHiddenSegments: false,
  });

  if (
    resolved.relativePath === "Shared" ||
    resolved.relativePath.startsWith("Shared/")
  ) {
    throw new LocalSharingError("Cannot share from /Shared", {
      code: "invalid_path",
      statusCode: 400,
    });
  }

  const info = await lstat(resolved.absolutePath);
  if (info.isSymbolicLink()) {
    throw new LocalSharingError("Symlinks are not allowed", {
      code: "symlink_blocked",
      statusCode: 403,
    });
  }
  if (!info.isDirectory()) {
    throw new LocalSharingError("Only folders can be shared", {
      code: "not_a_directory",
      statusCode: 400,
    });
  }

  return resolved;
}

async function resolveExportPath(sharedPath: string) {
  return resolvePathWithinFilesRoot({
    inputPath: sharedPath,
    requiredPrefix: "Shared",
    allowHiddenSegments: false,
    allowMissingLeaf: true,
  });
}

async function ensureShareMounted(sourceAbsolutePath: string, exportAbsolutePath: string) {
  await mkdir(exportAbsolutePath, {
    recursive: true,
  });
  const mounted = await isMountPoint(exportAbsolutePath);
  if (!mounted) {
    await runCommand("mount", ["--bind", sourceAbsolutePath, exportAbsolutePath]);
  }
}

async function ensureUsershareExported(shareName: string, exportAbsolutePath: string) {
  const exported = await isUsersharePresent(shareName);
  if (!exported) {
    await runCommand("net", [
      "usershare",
      "add",
      shareName,
      exportAbsolutePath,
      "Home Server shared folder",
      "Everyone:F",
      "guest_ok=y",
    ]);
  }
}

async function releaseShareExport(record: LocalShareRecord) {
  const exportResolved = await resolveExportPath(record.sharedPath);
  const usersharePresent = await isUsersharePresent(record.shareName);
  if (usersharePresent) {
    await runCommand("net", ["usershare", "delete", record.shareName]);
  }

  const mounted = await isMountPoint(exportResolved.absolutePath);
  if (mounted) {
    await runCommand("umount", [exportResolved.absolutePath]);
  }

  await rm(exportResolved.absolutePath, {
    recursive: false,
    force: true,
  });

  const sharedRoot = path.dirname(exportResolved.absolutePath);
  try {
    const entries = await readdir(sharedRoot);
    if (entries.length === 0) {
      await rm(sharedRoot, {
        recursive: false,
        force: true,
      });
    }
  } catch {
    // ignored
  }
}

async function nextUniqueShareName(baseName: string) {
  const rootName = sanitizeShareName(baseName, "shared-folder");
  let candidate = rootName;

  for (let index = 1; index <= 500; index += 1) {
    const existing = await getLocalShareByShareNameFromDb(candidate);
    if (!existing) {
      return candidate;
    }
    candidate = sanitizeShareName(`${rootName}-${index + 1}`, rootName);
  }

  throw new LocalSharingError("Unable to allocate a unique share name", {
    code: "share_exists",
    statusCode: 409,
  });
}

async function resolveShareState(record: LocalShareRecord) {
  const exportResolved = await resolveExportPath(record.sharedPath);
  const [isMounted, isExported] = await Promise.all([
    isMountPoint(exportResolved.absolutePath),
    isUsersharePresent(record.shareName),
  ]);
  return {
    isMounted,
    isExported,
  };
}

export async function listLocalFolderShares(): Promise<LocalFolderShareStatus[]> {
  const records = await listLocalSharesFromDb();

  return Promise.all(
    records.map(async (record) => {
      const state = await resolveShareState(record);
      return toShareStatus(record, state);
    }),
  );
}

export async function addLocalFolderShare(
  input: CreateLocalFolderShareRequest,
): Promise<LocalFolderShareStatus> {
  try {
    const source = await resolveSourcePath(input.path);
    const existingBySource = await getLocalShareBySourcePathFromDb(
      source.relativePath,
    );
    if (existingBySource) {
      throw new LocalSharingError("Folder is already shared", {
        code: "share_exists",
        statusCode: 409,
      });
    }

    await ensureSharedRoot();

    const sourceBaseName = path.posix.basename(source.relativePath || "share");
    const preferredName = sanitizeShareName(input.name ?? sourceBaseName, sourceBaseName);
    const shareName = await nextUniqueShareName(preferredName);
    const sharedPath = path.posix.join("Shared", shareName);
    const exportTarget = await resolveExportPath(sharedPath);

    await ensureShareMounted(source.absolutePath, exportTarget.absolutePath);
    try {
      await ensureUsershareExported(shareName, exportTarget.absolutePath);
    } catch (error) {
      const mounted = await isMountPoint(exportTarget.absolutePath);
      if (mounted) {
        await runCommand("umount", [exportTarget.absolutePath]).catch(() => undefined);
      }
      await rm(exportTarget.absolutePath, {
        recursive: false,
        force: true,
      }).catch(() => undefined);

      throw error;
    }

    const record = await insertLocalShareInDb({
      id: randomUUID(),
      shareName,
      sourcePath: source.relativePath,
      sharedPath,
    });

    return toShareStatus(record, {
      isMounted: true,
      isExported: true,
    });
  } catch (error) {
    throw mapFsError(error, "Failed to share folder");
  }
}

export async function removeLocalFolderShare(shareId: string) {
  const record = await getLocalShareFromDb(shareId);
  if (!record) {
    throw new LocalSharingError("Shared folder not found", {
      code: "share_not_found",
      statusCode: 404,
    });
  }

  try {
    await releaseShareExport(record);
  } catch (error) {
    throw mapFsError(error, "Failed to remove shared folder");
  }

  await deleteLocalShareFromDb(record.id);

  return {
    removed: true,
    id: record.id,
  };
}
