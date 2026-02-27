import "server-only";

import { readFile, readdir, lstat, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  FilesPathError,
  resolvePathWithinFilesRoot,
  type ResolvedFilesPath,
} from "@/lib/server/modules/files/path-resolver";
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

type ListDirectoryParams = {
  path?: string;
  includeHidden?: boolean;
};

type ReadFileForViewerParams = {
  path: string;
  includeHidden?: boolean;
};

type WriteTextFileParams = {
  path: string;
  content: string;
  expectedMtimeMs?: number;
  includeHidden?: boolean;
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

function isTrashPathSegments(segments: string[]) {
  return segments[0] === "Trash";
}

function mapFsError(
  error: unknown,
  fallbackMessage: string,
  absolutePath?: string,
) {
  if (error instanceof FileServiceError) return error;
  if (error instanceof FilesPathError) {
    return new FileServiceError(error.message, {
      code: error.code,
      statusCode: error.statusCode,
      cause: error,
    });
  }

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
    return new FileServiceError(
      `Permission denied${absolutePath ? `: ${absolutePath}` : ""}`,
      {
        code: "permission_denied",
        statusCode: 403,
        cause: error,
      },
    );
  }
  if (nodeError?.code === "ELOOP") {
    return new FileServiceError("Symlinks are not allowed", {
      code: "symlink_blocked",
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
  const preResolved = await resolvePathWithinFilesRoot({
    inputPath,
    allowEmpty: true,
    allowHiddenSegments: true,
  });
  if (!includeHidden && !isTrashPathSegments(preResolved.segments)) {
    const hiddenSegment = preResolved.segments.find((segment) =>
      isHiddenName(segment),
    );
    if (hiddenSegment) {
      throw new FileServiceError("Hidden files are not allowed", {
        code: "hidden_blocked",
        statusCode: 403,
      });
    }
  }
  return preResolved;
}

export async function listDirectory(params: ListDirectoryParams = {}): Promise<FileListResponse> {
  const includeHidden = Boolean(params.includeHidden);
  let resolved: ResolvedFilesPath;

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
    throw mapFsError(
      error,
      "Failed to list directory",
      resolved?.absolutePath,
    );
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
      root: resolved.rootPath,
      cwd: resolved.relativePath,
      entries: sortDirectoryEntries(output),
    };
  } catch (error) {
    throw mapFsError(
      error,
      "Failed to list directory",
      resolved.absolutePath,
    );
  }
}

export async function readFileForViewer(params: ReadFileForViewerParams): Promise<FileReadResponse> {
  let resolved: ResolvedFilesPath;
  let info: Awaited<ReturnType<typeof stat>>;

  try {
    resolved = await resolveFilePath(params.path, Boolean(params.includeHidden));
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
    throw mapFsError(
      error,
      "Failed to open file",
      resolved?.absolutePath,
    );
  }

  const name = path.basename(resolved.absolutePath);
  const ext = getExtension(name);
  const mode = toViewerMode(ext);
  const mimeType = getMimeTypeForExtension(ext);

  if (mode === "text") {
    if (info.size > MAX_TEXT_READ_BYTES) {
      return {
        root: resolved.rootPath,
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
        root: resolved.rootPath,
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
      throw mapFsError(
        error,
        "Failed to read file",
        resolved.absolutePath,
      );
    }
  }

  return {
    root: resolved.rootPath,
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

  let resolved: ResolvedFilesPath;
  let currentInfo: Awaited<ReturnType<typeof stat>>;

  try {
    resolved = await resolveFilePath(params.path, Boolean(params.includeHidden));
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
    throw mapFsError(
      error,
      "Failed to save file",
      resolved?.absolutePath,
    );
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
    const target = await resolvePathWithinFilesRoot({
      inputPath: params.path,
      allowHiddenSegments: Boolean(params.includeHidden),
    });
    if (target.absolutePath !== resolved.absolutePath) {
      throw new FileServiceError("File changed while resolving target path", {
        code: "write_conflict",
        statusCode: 409,
      });
    }

    await writeFile(resolved.absolutePath, params.content, "utf8");
    const savedInfo = await stat(resolved.absolutePath);
    return {
      root: resolved.rootPath,
      path: resolved.relativePath,
      sizeBytes: savedInfo.size,
      modifiedAt: savedInfo.mtime.toISOString(),
      mtimeMs: savedInfo.mtimeMs,
    };
  } catch (error) {
    throw mapFsError(
      error,
      "Failed to save file",
      resolved.absolutePath,
    );
  }
}

export async function resolveReadableFileAbsolutePath(input: {
  path: string;
  includeHidden?: boolean;
}) {
  let resolved: ResolvedFilesPath;

  try {
    resolved = await resolveFilePath(input.path, Boolean(input.includeHidden));
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
    throw mapFsError(
      error,
      "Failed to resolve file",
      resolved?.absolutePath,
    );
  }

  return {
    root: resolved.rootPath,
    path: resolved.relativePath,
    absolutePath: resolved.absolutePath,
  };
}
