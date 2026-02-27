import "server-only";

import { constants as fsConstants } from "node:fs";
import { access, lstat, mkdir, realpath } from "node:fs/promises";
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
  const rootPath = toAbsoluteFilesRoot();
  await mkdir(rootPath, {
    recursive: true,
  });

  const relativePath = normalizeRelativeInput(
    input.inputPath ?? "",
    input.allowEmpty ?? false,
  );
  const segments = relativePath ? relativePath.split("/") : [];

  assertAllowedSegments(
    segments,
    input.allowHiddenSegments ?? false,
    input.requiredPrefix,
  );

  const absoluteCandidate = path.resolve(
    rootPath,
    ...segments.map((segment) => segment.replaceAll("/", path.sep)),
  );

  if (!isWithinRoot(rootPath, absoluteCandidate)) {
    throw new FilesPathError("Path escapes root", {
      code: "path_outside_root",
      statusCode: 400,
    });
  }

  const exists = await ensureNoSymlinkTraversal(
    rootPath,
    segments,
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
    if (!isWithinRoot(rootPath, canonical)) {
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
  await mkdir(path.join(rootPath, "Shared"), {
    recursive: true,
  });
  await mkdir(path.join(rootPath, "Network"), {
    recursive: true,
  });
  await mkdir(path.join(rootPath, "Trash"), {
    recursive: true,
  });
  return rootPath;
}
