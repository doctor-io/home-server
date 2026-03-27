import "server-only";

import { constants as fsConstants } from "node:fs";
import { access, lstat, mkdir, readdir, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "@/lib/server/env";
import type { FileServiceErrorCode } from "@/lib/shared/contracts/files";

type FilesPathErrorCode = FileServiceErrorCode;

type ResolvePathInput = {
  inputPath?: string;
  allowEmpty?: boolean;
  allowHiddenSegments?: boolean;
  allowMissingLeaf?: boolean;
  requiredPrefix?: string;
};

export type ResolvedFilesPath = {
  rootPath: string;
  relativePath: string;
  absolutePath: string;
  segments: string[];
  exists: boolean;
};

export type FilesRootInfo = {
  rootPath: string;
  effectiveUid: number | null;
  effectiveGid: number | null;
  writable: boolean;
};

export class FilesPathError extends Error {
  readonly code: FilesPathErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      code?: FilesPathErrorCode;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });
    this.name = "FilesPathError";
    this.code = options?.code ?? "internal_error";
    this.statusCode = options?.statusCode ?? 500;
  }
}

const INTERNAL_ROOT_DIRECTORY_MAP = {
  Shared: ".Shared",
  Network: ".Network",
  Trash: ".Trash",
} as const;

function toAbsoluteFilesRoot() {
  const configuredRoot = serverEnv.FILES_ROOT;
  if (path.isAbsolute(configuredRoot)) {
    return path.resolve(configuredRoot);
  }
  return path.resolve(process.cwd(), configuredRoot);
}

function isWithinRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function normalizeRelativeInput(rawInput: string, allowEmpty: boolean) {
  const cleaned = rawInput.trim().replaceAll("\\", "/");
  if (cleaned.includes("\0")) {
    throw new FilesPathError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }
  if (cleaned.length === 0) {
    if (!allowEmpty) {
      throw new FilesPathError("Invalid path", {
        code: "invalid_path",
        statusCode: 400,
      });
    }
    return "";
  }
  if (cleaned.startsWith("/") || /^[A-Za-z]:\//.test(cleaned)) {
    throw new FilesPathError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }

  const normalized = path.posix.normalize(cleaned);
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new FilesPathError("Path escapes root", {
      code: "path_outside_root",
      statusCode: 400,
    });
  }

  return normalized === "." ? "" : normalized;
}

function assertAllowedSegments(
  segments: string[],
  allowHiddenSegments: boolean,
  requiredPrefix?: string,
) {
  if (!allowHiddenSegments && segments.some((segment) => segment.startsWith("."))) {
    throw new FilesPathError("Hidden files are not allowed", {
      code: "hidden_blocked",
      statusCode: 403,
    });
  }

  if (requiredPrefix) {
    const relative = segments.join("/");
    if (
      relative !== requiredPrefix &&
      !relative.startsWith(`${requiredPrefix}/`)
    ) {
      throw new FilesPathError("Invalid path", {
        code: "invalid_path",
        statusCode: 400,
      });
    }
  }
}

function toFilesystemSegments(segments: string[]) {
  if (segments.length === 0) {
    return segments;
  }

  const [rootSegment, ...rest] = segments;
  const mappedRoot =
    INTERNAL_ROOT_DIRECTORY_MAP[
      rootSegment as keyof typeof INTERNAL_ROOT_DIRECTORY_MAP
    ] ?? rootSegment;

  return [mappedRoot, ...rest];
}

async function ensureNoSymlinkTraversal(
  rootPath: string,
  segments: string[],
  allowMissingLeaf: boolean,
) {
  let traversed = rootPath;
  let exists = true;

  for (let index = 0; index < segments.length; index += 1) {
    traversed = path.join(traversed, segments[index]);
    try {
      const info = await lstat(traversed);
      if (info.isSymbolicLink()) {
        throw new FilesPathError("Symlinks are not allowed", {
          code: "symlink_blocked",
          statusCode: 403,
        });
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === "ENOENT") {
        if (allowMissingLeaf) {
          exists = false;
          break;
        }
        throw new FilesPathError("File or directory not found", {
          code: "not_found",
          statusCode: 404,
          cause: error,
        });
      }
      throw error;
    }
  }

  return exists;
}

export async function resolvePathWithinFilesRoot(
  input: ResolvePathInput = {},
): Promise<ResolvedFilesPath> {
  const rootPath = await ensureFilesRootDirectories();
  const canonicalRootPath = await realpath(rootPath).catch(() => rootPath);

  const relativePath = normalizeRelativeInput(
    input.inputPath ?? "",
    input.allowEmpty ?? false,
  );
  const segments = relativePath ? relativePath.split("/") : [];
  const filesystemSegments = toFilesystemSegments(segments);

  assertAllowedSegments(
    segments,
    input.allowHiddenSegments ?? false,
    input.requiredPrefix,
  );

  const absoluteCandidate = path.resolve(
    rootPath,
    ...filesystemSegments.map((segment) => segment.replaceAll("/", path.sep)),
  );

  if (!isWithinRoot(rootPath, absoluteCandidate)) {
    throw new FilesPathError("Path escapes root", {
      code: "path_outside_root",
      statusCode: 400,
    });
  }

  const exists = await ensureNoSymlinkTraversal(
    rootPath,
    filesystemSegments,
    input.allowMissingLeaf ?? false,
  );

  if (!exists && !(input.allowMissingLeaf ?? false)) {
    throw new FilesPathError("File or directory not found", {
      code: "not_found",
      statusCode: 404,
    });
  }

  let absolutePath = absoluteCandidate;
  if (exists) {
    const canonical = await realpath(absoluteCandidate);
    if (!isWithinRoot(canonicalRootPath, canonical)) {
      throw new FilesPathError("Path escapes root", {
        code: "path_outside_root",
        statusCode: 400,
      });
    }
    absolutePath = canonical;
  }

  return {
    rootPath,
    relativePath,
    absolutePath,
    segments,
    exists,
  };
}

export async function getFilesRootInfo(): Promise<FilesRootInfo> {
  const rootPath = toAbsoluteFilesRoot();
  await mkdir(rootPath, {
    recursive: true,
  });

  let writable = true;
  try {
    await access(rootPath, fsConstants.W_OK);
  } catch {
    writable = false;
  }

  const processWithIds = process as NodeJS.Process & {
    geteuid?: () => number;
    getegid?: () => number;
  };

  return {
    rootPath,
    effectiveUid: typeof processWithIds.geteuid === "function" ? processWithIds.geteuid() : null,
    effectiveGid: typeof processWithIds.getegid === "function" ? processWithIds.getegid() : null,
    writable,
  };
}

export async function ensureFilesRootDirectories() {
  const rootPath = toAbsoluteFilesRoot();
  await mkdir(rootPath, {
    recursive: true,
  });

  for (const [publicName, hiddenName] of Object.entries(INTERNAL_ROOT_DIRECTORY_MAP)) {
    const publicPath = path.join(rootPath, publicName);
    const hiddenPath = path.join(rootPath, hiddenName);

    const publicInfo = await lstat(publicPath).catch((error: unknown) => {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return null;
      }
      throw error;
    });
    const hiddenInfo = await lstat(hiddenPath).catch((error: unknown) => {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === "ENOENT") {
        return null;
      }
      throw error;
    });

    if (publicInfo?.isDirectory() && !hiddenInfo) {
      await rename(publicPath, hiddenPath);
    } else if (publicInfo?.isDirectory() && hiddenInfo?.isDirectory()) {
      const publicEntries = await readdir(publicPath);
      for (const entryName of publicEntries) {
        const sourcePath = path.join(publicPath, entryName);
        const targetPath = path.join(hiddenPath, entryName);
        const targetExists = await lstat(targetPath).catch((error: unknown) => {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError.code === "ENOENT") {
            return null;
          }
          throw error;
        });
        if (!targetExists) {
          await rename(sourcePath, targetPath);
        }
      }

      const remainingEntries = await readdir(publicPath);
      if (remainingEntries.length === 0) {
        await rm(publicPath, { recursive: true, force: true });
      }
    }

    await mkdir(hiddenPath, {
      recursive: true,
    });
  }
  return rootPath;
}
