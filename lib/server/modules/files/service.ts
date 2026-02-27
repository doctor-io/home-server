import "server-only";

import { readFile, readdir, lstat, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ensureDataRootDirectories,
  resolveDataRootDirectory,
} from "@/lib/server/storage/data-root";
import type {
  FileListEntry,
  FileListResponse,
  FileReadMode,
  FileReadResponse,
  FileServiceErrorCode,
  FileWriteResponse,
} from "@/lib/shared/contracts/files";

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "yaml",
  "yml",
  "conf",
  "env",
  "log",
  "csv",
  "sh",
  "py",
  "js",
  "ts",
  "css",
  "html",
  "xml",
  "sql",
  "ini",
]);

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
};

export const MAX_TEXT_READ_BYTES = 2 * 1024 * 1024;
const ROOT_LABEL = "/";

type ListDirectoryParams = {
  path?: string;
  includeHidden?: boolean;
};

type ReadFileForViewerParams = {
  path: string;
};

type WriteTextFileParams = {
  path: string;
  content: string;
  expectedMtimeMs?: number;
};

type ResolvedFilePath = {
  rootPath: string;
  relativePath: string;
  absolutePath: string;
  segments: string[];
};

export class FileServiceError extends Error {
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
    this.name = "FileServiceError";
    this.code = options?.code ?? "internal_error";
    this.statusCode = options?.statusCode ?? 500;
  }
}

function getExtension(fileName: string) {
  const raw = path.extname(fileName).slice(1).toLowerCase();
  return raw.length > 0 ? raw : null;
}

function isHiddenName(name: string) {
  return name.startsWith(".");
}

function getPosixRelativePath(input: string | undefined) {
  if (!input) return "";

  const cleaned = input.trim().replaceAll("\\", "/");
  if (cleaned.length === 0) return "";
  if (cleaned.includes("\0")) {
    throw new FileServiceError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }
  if (cleaned.startsWith("/")) {
    throw new FileServiceError("Path must be relative", {
      code: "invalid_path",
      statusCode: 400,
    });
  }

  const normalized = path.posix.normalize(cleaned);
  if (normalized === "." || normalized === "") {
    return "";
  }
  if (normalized === ".." || normalized.startsWith("../")) {
    throw new FileServiceError("Path escapes root", {
      code: "path_outside_root",
      statusCode: 400,
    });
  }

  return normalized;
}

function assertNoHiddenSegments(segments: string[]) {
  if (segments.some((segment) => isHiddenName(segment))) {
    throw new FileServiceError("Hidden files are not allowed", {
      code: "hidden_blocked",
      statusCode: 403,
    });
  }
}

function isTrashPathSegments(segments: string[]) {
  return segments[0] === "Trash";
}

function ensureWithinRoot(rootPath: string, absolutePath: string) {
  const relative = path.relative(rootPath, absolutePath);
  const within = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (!within) {
    throw new FileServiceError("Path escapes root", {
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
        throw new FileServiceError("Symlinks are not allowed", {
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

function mapFsError(error: unknown, fallbackMessage: string) {
  if (error instanceof FileServiceError) return error;

  const nodeError = error as NodeJS.ErrnoException;
  if (nodeError?.code === "ENOENT") {
    return new FileServiceError("File or directory not found", {
      code: "not_found",
      statusCode: 404,
      cause: error,
    });
  }
  if (nodeError?.code === "ENOTDIR") {
    return new FileServiceError("Path is not a directory", {
      code: "not_a_directory",
      statusCode: 400,
      cause: error,
    });
  }
  if (nodeError?.code === "EISDIR") {
    return new FileServiceError("Path is not a file", {
      code: "not_a_file",
      statusCode: 400,
      cause: error,
    });
  }
  if (nodeError?.code === "EACCES" || nodeError?.code === "EPERM") {
    return new FileServiceError("Access denied", {
      code: "invalid_path",
      statusCode: 403,
      cause: error,
    });
  }

  return new FileServiceError(fallbackMessage, {
    code: "internal_error",
    statusCode: 500,
    cause: error,
  });
}

function isTextExtension(extension: string | null) {
  if (!extension) return false;
  return TEXT_EXTENSIONS.has(extension);
}

export function getMimeTypeForExtension(extension: string | null) {
  if (!extension) return null;
  if (extension in IMAGE_MIME_BY_EXTENSION) return IMAGE_MIME_BY_EXTENSION[extension];
  if (extension === "pdf") return "application/pdf";
  if (TEXT_EXTENSIONS.has(extension)) return "text/plain; charset=utf-8";
  return null;
}

function toViewerMode(extension: string | null): FileReadMode {
  if (!extension) return "binary_unsupported";
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (extension in IMAGE_MIME_BY_EXTENSION) return "image";
  if (extension === "pdf") return "pdf";
  return "binary_unsupported";
}

function toPublicPath(segments: string[]) {
  return segments.join("/");
}

function sortDirectoryEntries(entries: FileListEntry[]) {
  return entries.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "folder" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

async function resolveFilePath(inputPath: string | undefined, includeHidden: boolean) {
  resolveDataRootDirectory();
  const ensured = await ensureDataRootDirectories();
  const rootPath = ensured.dataRoot;

  const relativePath = getPosixRelativePath(inputPath);
  const segments = relativePath.length > 0 ? relativePath.split("/") : [];
  if (!includeHidden && !isTrashPathSegments(segments)) {
    assertNoHiddenSegments(segments);
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

export async function listDirectory(params: ListDirectoryParams = {}): Promise<FileListResponse> {
  const includeHidden = Boolean(params.includeHidden);
  let resolved: ResolvedFilePath;

  try {
    resolved = await resolveFilePath(params.path, includeHidden);
    const info = await lstat(resolved.absolutePath);
    if (info.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }
    if (!info.isDirectory()) {
      throw new FileServiceError("Path is not a directory", {
        code: "not_a_directory",
        statusCode: 400,
      });
    }
  } catch (error) {
    throw mapFsError(error, "Failed to list directory");
  }

  try {
    const entries = await readdir(resolved.absolutePath, {
      withFileTypes: true,
    });
    const output: FileListEntry[] = [];
    const listingTrash = isTrashPathSegments(resolved.segments);

    for (const entry of entries) {
      if (!includeHidden && !listingTrash && isHiddenName(entry.name)) {
        continue;
      }

      const absoluteEntryPath = path.join(resolved.absolutePath, entry.name);
      const info = await lstat(absoluteEntryPath);
      if (info.isSymbolicLink()) {
        continue;
      }

      const type = info.isDirectory() ? "folder" : info.isFile() ? "file" : null;
      if (!type) continue;

      output.push({
        name: entry.name,
        path: toPublicPath([...resolved.segments, entry.name]),
        type,
        ext: type === "file" ? getExtension(entry.name) : null,
        sizeBytes: type === "file" ? info.size : null,
        modifiedAt: info.mtime.toISOString(),
        mtimeMs: info.mtimeMs,
      });
    }

    return {
      root: ROOT_LABEL,
      cwd: resolved.relativePath,
      entries: sortDirectoryEntries(output),
    };
  } catch (error) {
    throw mapFsError(error, "Failed to list directory");
  }
}

export async function readFileForViewer(params: ReadFileForViewerParams): Promise<FileReadResponse> {
  let resolved: ResolvedFilePath;
  let info: Awaited<ReturnType<typeof stat>>;

  try {
    resolved = await resolveFilePath(params.path, false);
    const linkInfo = await lstat(resolved.absolutePath);
    if (linkInfo.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }
    if (!linkInfo.isFile()) {
      throw new FileServiceError("Path is not a file", {
        code: "not_a_file",
        statusCode: 400,
      });
    }
    info = await stat(resolved.absolutePath);
  } catch (error) {
    throw mapFsError(error, "Failed to open file");
  }

  const name = path.basename(resolved.absolutePath);
  const ext = getExtension(name);
  const mode = toViewerMode(ext);
  const mimeType = getMimeTypeForExtension(ext);

  if (mode === "text") {
    if (info.size > MAX_TEXT_READ_BYTES) {
      return {
        root: ROOT_LABEL,
        path: resolved.relativePath,
        name,
        ext,
        mode: "too_large",
        mimeType,
        sizeBytes: info.size,
        modifiedAt: info.mtime.toISOString(),
        mtimeMs: info.mtimeMs,
        content: null,
      };
    }

    try {
      const content = await readFile(resolved.absolutePath, "utf8");
      return {
        root: ROOT_LABEL,
        path: resolved.relativePath,
        name,
        ext,
        mode,
        mimeType,
        sizeBytes: info.size,
        modifiedAt: info.mtime.toISOString(),
        mtimeMs: info.mtimeMs,
        content,
      };
    } catch (error) {
      throw mapFsError(error, "Failed to read file");
    }
  }

  return {
    root: ROOT_LABEL,
    path: resolved.relativePath,
    name,
    ext,
    mode,
    mimeType,
    sizeBytes: info.size,
    modifiedAt: info.mtime.toISOString(),
    mtimeMs: info.mtimeMs,
    content: null,
  };
}

export async function writeTextFile(params: WriteTextFileParams): Promise<FileWriteResponse> {
  const byteLength = Buffer.byteLength(params.content, "utf8");
  if (byteLength > MAX_TEXT_READ_BYTES) {
    throw new FileServiceError("Payload too large", {
      code: "payload_too_large",
      statusCode: 413,
    });
  }

  let resolved: ResolvedFilePath;
  let currentInfo: Awaited<ReturnType<typeof stat>>;

  try {
    resolved = await resolveFilePath(params.path, false);
    const linkInfo = await lstat(resolved.absolutePath);
    if (linkInfo.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }
    if (!linkInfo.isFile()) {
      throw new FileServiceError("Path is not a file", {
        code: "not_a_file",
        statusCode: 400,
      });
    }
    currentInfo = await stat(resolved.absolutePath);
  } catch (error) {
    throw mapFsError(error, "Failed to save file");
  }

  const ext = getExtension(path.basename(resolved.absolutePath));
  if (!isTextExtension(ext)) {
    throw new FileServiceError("Unsupported file type for save", {
      code: "unsupported_file",
      statusCode: 415,
    });
  }

  if (
    typeof params.expectedMtimeMs === "number" &&
    Number.isFinite(params.expectedMtimeMs) &&
    currentInfo.mtimeMs !== params.expectedMtimeMs
  ) {
    throw new FileServiceError("File changed since it was opened", {
      code: "write_conflict",
      statusCode: 409,
    });
  }

  try {
    await writeFile(resolved.absolutePath, params.content, "utf8");
    const savedInfo = await stat(resolved.absolutePath);
    return {
      root: ROOT_LABEL,
      path: resolved.relativePath,
      sizeBytes: savedInfo.size,
      modifiedAt: savedInfo.mtime.toISOString(),
      mtimeMs: savedInfo.mtimeMs,
    };
  } catch (error) {
    throw mapFsError(error, "Failed to save file");
  }
}

export async function resolveReadableFileAbsolutePath(input: { path: string }) {
  let resolved: ResolvedFilePath;

  try {
    resolved = await resolveFilePath(input.path, false);
    const linkInfo = await lstat(resolved.absolutePath);
    if (linkInfo.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }
    if (!linkInfo.isFile()) {
      throw new FileServiceError("Path is not a file", {
        code: "not_a_file",
        statusCode: 400,
      });
    }
  } catch (error) {
    throw mapFsError(error, "Failed to resolve file");
  }

  return {
    root: ROOT_LABEL,
    path: resolved.relativePath,
    absolutePath: resolved.absolutePath,
  };
}
