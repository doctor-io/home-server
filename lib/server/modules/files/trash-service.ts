import "server-only";

import { randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { ensureDataRootDirectories } from "@/lib/server/storage/data-root";
import type {
  FileServiceErrorCode,
  TrashRestoreRequest,
  TrashRestoreResponse,
} from "@/lib/shared/contracts/files";
import {
  deleteTrashEntryFromDb,
  getTrashEntryFromDb,
  upsertTrashEntryInDb,
} from "@/lib/server/modules/files/trash-repository";

export class TrashServiceError extends Error {
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
    this.name = "TrashServiceError";
    this.code = options?.code ?? "internal_error";
    this.statusCode = options?.statusCode ?? 500;
  }
}

type CollisionMode = NonNullable<TrashRestoreRequest["collision"]>;

type ResolvedFilePath = {
  rootPath: string;
  relativePath: string;
  absolutePath: string;
  segments: string[];
};

function isHiddenName(name: string) {
  return name.startsWith(".");
}

function normalizeRelativePath(input: string | undefined, allowEmpty = false) {
  if (!input) {
    if (allowEmpty) return "";
    throw new TrashServiceError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }

  const cleaned = input.trim().replaceAll("\\", "/");
  if (cleaned.length === 0) {
    if (allowEmpty) return "";
    throw new TrashServiceError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }
  if (cleaned.includes("\0") || cleaned.startsWith("/")) {
    throw new TrashServiceError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }

  const normalized = path.posix.normalize(cleaned);
  if (normalized === ".") {
    if (allowEmpty) return "";
    throw new TrashServiceError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new TrashServiceError("Path escapes root", {
      code: "path_outside_root",
      statusCode: 400,
    });
  }

  return normalized;
}

function ensureWithinRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath);
  const within =
    relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (!within) {
    throw new TrashServiceError("Path escapes root", {
      code: "path_outside_root",
      statusCode: 400,
    });
  }
}

async function assertNoSymlinks(rootPath: string, segments: string[]) {
  let current = rootPath;

  for (const segment of segments) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        throw new TrashServiceError("Symlinks are not allowed", {
          code: "symlink_blocked",
          statusCode: 403,
        });
      }
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === "ENOENT") {
        break;
      }
      throw error;
    }
  }
}

async function resolvePath(inputPath: string) {
  const ensured = await ensureDataRootDirectories();
  const rootPath = ensured.dataRoot;

  const relativePath = normalizeRelativePath(inputPath);
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.some((segment) => isHiddenName(segment))) {
    throw new TrashServiceError("Hidden files are not allowed", {
      code: "hidden_blocked",
      statusCode: 403,
    });
  }

  const absolutePath = path.resolve(rootPath, relativePath);
  ensureWithinRoot(rootPath, absolutePath);
  await assertNoSymlinks(rootPath, segments);

  return {
    rootPath,
    relativePath,
    absolutePath,
    segments,
  } satisfies ResolvedFilePath;
}

function toPosixRelative(rootPath: string, absolutePath: string) {
  return path.relative(rootPath, absolutePath).replaceAll(path.sep, "/");
}

function splitNameAndExtension(name: string) {
  const ext = path.extname(name);
  if (!ext) {
    return {
      base: name,
      extension: "",
    };
  }

  return {
    base: name.slice(0, -ext.length),
    extension: ext,
  };
}

async function pathExists(absolutePath: string) {
  try {
    await lstat(absolutePath);
    return true;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function uniquePathFromTarget(targetAbsolutePath: string) {
  if (!(await pathExists(targetAbsolutePath))) {
    return targetAbsolutePath;
  }

  const directory = path.dirname(targetAbsolutePath);
  const name = path.basename(targetAbsolutePath);
  const { base, extension } = splitNameAndExtension(name);

  for (let index = 2; index <= 10_000; index += 1) {
    const candidate = path.join(
      directory,
      `${base} (${index})${extension}`,
    );
    if (!(await pathExists(candidate))) {
      return candidate;
    }
  }

  throw new TrashServiceError("Unable to resolve unique restore path", {
    code: "internal_error",
    statusCode: 500,
  });
}

async function movePath(sourceAbsolutePath: string, destinationAbsolutePath: string) {
  try {
    await rename(sourceAbsolutePath, destinationAbsolutePath);
    return;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code !== "EXDEV") {
      throw error;
    }
  }

  await cp(sourceAbsolutePath, destinationAbsolutePath, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await rm(sourceAbsolutePath, {
    recursive: true,
    force: true,
  });
}

function mapFsError(error: unknown, fallbackMessage: string) {
  if (error instanceof TrashServiceError) return error;

  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError?.code === "ENOENT") {
    return new TrashServiceError("File or directory not found", {
      code: "not_found",
      statusCode: 404,
      cause: error,
    });
  }
  if (nodeError?.code === "EEXIST") {
    return new TrashServiceError("Destination already exists", {
      code: "destination_exists",
      statusCode: 409,
      cause: error,
    });
  }
  if (nodeError?.code === "ENOTDIR") {
    return new TrashServiceError("Path is not a directory", {
      code: "not_a_directory",
      statusCode: 400,
      cause: error,
    });
  }
  if (nodeError?.code === "EISDIR") {
    return new TrashServiceError("Path is not a file", {
      code: "not_a_file",
      statusCode: 400,
      cause: error,
    });
  }

  return new TrashServiceError(fallbackMessage, {
    code: "internal_error",
    statusCode: 500,
    cause: error,
  });
}

async function assertTrashPath(pathInput: string) {
  const resolved = await resolvePath(pathInput);
  if (
    resolved.relativePath !== "Trash" &&
    !resolved.relativePath.startsWith("Trash/")
  ) {
    throw new TrashServiceError("Path is not in Trash", {
      code: "invalid_path",
      statusCode: 400,
    });
  }
  return resolved;
}

async function pruneEmptyAncestors(basePath: string, absolutePath: string) {
  let current = path.dirname(absolutePath);
  const boundary = path.resolve(basePath);

  while (current.startsWith(boundary) && current !== boundary) {
    try {
      const files = await readdir(current);
      if (files.length > 0) return;
      await rm(current, {
        recursive: false,
      });
      current = path.dirname(current);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (
        nodeError?.code === "ENOTEMPTY" ||
        nodeError?.code === "ENOENT" ||
        nodeError?.code === "ENOTDIR"
      ) {
        return;
      }

      return;
    }
  }
}

export async function moveToTrash(pathInput: string) {
  let source: ResolvedFilePath;

  try {
    source = await resolvePath(pathInput);
    if (
      source.relativePath === "Trash" ||
      source.relativePath.startsWith("Trash/")
    ) {
      throw new TrashServiceError("Cannot trash items already in Trash", {
        code: "invalid_path",
        statusCode: 400,
      });
    }

    const sourceInfo = await lstat(source.absolutePath);
    if (sourceInfo.isSymbolicLink()) {
      throw new TrashServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }

    const trashRoot = await resolvePath("Trash");
    const trashTarget = await uniquePathFromTarget(
      path.join(trashRoot.absolutePath, path.basename(source.absolutePath)),
    );

    await movePath(source.absolutePath, trashTarget);

    const trashPath = toPosixRelative(source.rootPath, trashTarget);
    await upsertTrashEntryInDb({
      id: randomUUID(),
      trashPath,
      originalPath: source.relativePath,
      deletedAt: new Date(),
    });

    return {
      trashPath,
      originalPath: source.relativePath,
    };
  } catch (error) {
    throw mapFsError(error, "Failed to move item to Trash");
  }
}

export async function restoreFromTrash(
  pathInput: string,
  collisionMode: CollisionMode = "keep-both",
): Promise<TrashRestoreResponse> {
  let trashPath: ResolvedFilePath;

  try {
    trashPath = await assertTrashPath(pathInput);
    const sourceInfo = await lstat(trashPath.absolutePath);
    if (sourceInfo.isSymbolicLink()) {
      throw new TrashServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }

    const entry = await getTrashEntryFromDb(trashPath.relativePath);
    if (!entry) {
      throw new TrashServiceError("Trash metadata missing", {
        code: "trash_meta_missing",
        statusCode: 404,
      });
    }

    const restoreTarget = await resolvePath(entry.originalPath);
    await mkdir(path.dirname(restoreTarget.absolutePath), {
      recursive: true,
    });

    let destinationAbsolutePath = restoreTarget.absolutePath;
    const destinationExists = await pathExists(destinationAbsolutePath);
    if (destinationExists) {
      if (collisionMode === "fail") {
        throw new TrashServiceError("Destination already exists", {
          code: "destination_exists",
          statusCode: 409,
        });
      }
      if (collisionMode === "replace") {
        await rm(destinationAbsolutePath, {
          recursive: true,
          force: true,
        });
      }
      if (collisionMode === "keep-both") {
        destinationAbsolutePath = await uniquePathFromTarget(destinationAbsolutePath);
      }
    }

    await movePath(trashPath.absolutePath, destinationAbsolutePath);
    await deleteTrashEntryFromDb(trashPath.relativePath);
    await pruneEmptyAncestors(path.join(trashPath.rootPath, "Trash"), trashPath.absolutePath);

    return {
      restoredPath: toPosixRelative(trashPath.rootPath, destinationAbsolutePath),
      sourceTrashPath: trashPath.relativePath,
    };
  } catch (error) {
    throw mapFsError(error, "Failed to restore item from Trash");
  }
}

export async function deleteFromTrash(pathInput: string) {
  let trashPath: ResolvedFilePath;

  try {
    trashPath = await assertTrashPath(pathInput);
    const sourceInfo = await lstat(trashPath.absolutePath);
    if (sourceInfo.isSymbolicLink()) {
      throw new TrashServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }

    await rm(trashPath.absolutePath, {
      recursive: true,
      force: false,
    });
    await deleteTrashEntryFromDb(trashPath.relativePath);
    await pruneEmptyAncestors(path.join(trashPath.rootPath, "Trash"), trashPath.absolutePath);

    return {
      deleted: true,
      path: trashPath.relativePath,
    };
  } catch (error) {
    throw mapFsError(error, "Failed to permanently delete item from Trash");
  }
}
