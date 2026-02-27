import "server-only";

import {
  cp,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  FilesPathError,
  resolvePathWithinFilesRoot,
  type ResolvedFilesPath,
} from "@/lib/server/modules/files/path-resolver";
import {
  isPathStarredInDb,
  listStarredPathsFromDb,
  setPathStarredInDb,
} from "@/lib/server/modules/files/stars-repository";
import type {
  FileInfoResponse,
  FileListEntry,
  FileListResponse,
  FilePasteOperation,
  FilePasteResponse,
  FileReadMode,
  FileReadResponse,
  FileCreateResponse,
  FileRenameResponse,
  FileServiceErrorCode,
  FileToggleStarResponse,
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

type CreateEntryParams = {
  parentPath?: string;
  name: string;
  includeHidden?: boolean;
};

type PasteEntryParams = {
  sourcePath: string;
  destinationPath?: string;
  operation: FilePasteOperation;
  includeHidden?: boolean;
};

type RenameEntryParams = {
  path: string;
  newName: string;
  includeHidden?: boolean;
};

type GetEntryInfoParams = {
  path: string;
  includeHidden?: boolean;
};

type ToggleStarEntryParams = {
  path: string;
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
  if (nodeError?.code === "EEXIST") {
    return new FileServiceError("Destination already exists", {
      code: "destination_exists",
      statusCode: 409,
      cause: error,
    });
  }
  if (nodeError?.code === "EXDEV") {
    return new FileServiceError("Move across filesystem boundaries failed", {
      code: "internal_error",
      statusCode: 500,
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

function toPermissionsString(mode: number) {
  return `0${(mode & 0o777).toString(8).padStart(3, "0")}`;
}

function toEntryType(info: Awaited<ReturnType<typeof lstat>>) {
  if (info.isDirectory()) return "folder" as const;
  if (info.isFile()) return "file" as const;
  return null;
}

function sortDirectoryEntries(entries: FileListEntry[]) {
  return entries.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "folder" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });
}

function ensureSafeName(rawName: string, includeHidden: boolean) {
  const name = rawName.trim();
  if (name.length === 0 || name === "." || name === "..") {
    throw new FileServiceError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) {
    throw new FileServiceError("Invalid path", {
      code: "invalid_path",
      statusCode: 400,
    });
  }
  if (!includeHidden && isHiddenName(name)) {
    throw new FileServiceError("Hidden files are not allowed", {
      code: "hidden_blocked",
      statusCode: 403,
    });
  }
  return name;
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

async function resolveFilePath(
  inputPath: string | undefined,
  includeHidden: boolean,
  options: {
    allowEmpty?: boolean;
    allowMissingLeaf?: boolean;
  } = {},
) {
  const preResolved = await resolvePathWithinFilesRoot({
    inputPath,
    allowEmpty: options.allowEmpty ?? true,
    allowHiddenSegments: true,
    allowMissingLeaf: options.allowMissingLeaf ?? false,
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

async function assertDirectoryPath(
  inputPath: string | undefined,
  includeHidden: boolean,
  options: { allowEmpty?: boolean } = {},
) {
  const resolved = await resolveFilePath(inputPath, includeHidden, {
    allowEmpty: options.allowEmpty ?? true,
  });
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
  return resolved;
}

function joinRelativePath(baseSegments: string[], leafName: string) {
  if (baseSegments.length === 0) return leafName;
  return `${baseSegments.join("/")}/${leafName}`;
}

export async function listDirectory(params: ListDirectoryParams = {}): Promise<FileListResponse> {
  const includeHidden = Boolean(params.includeHidden);
  let resolved: ResolvedFilesPath | undefined;

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
    const starredPathSet = new Set(await listStarredPathsFromDb());
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
        starred: starredPathSet.has(toPublicPath([...resolved.segments, entry.name])),
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
  let resolved: ResolvedFilesPath | undefined;
  let info: Awaited<ReturnType<typeof stat>>;

  try {
    resolved = await resolveFilePath(params.path, Boolean(params.includeHidden), {
      allowEmpty: false,
    });
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

  let resolved: ResolvedFilesPath | undefined;
  let currentInfo: Awaited<ReturnType<typeof stat>>;

  try {
    resolved = await resolveFilePath(params.path, Boolean(params.includeHidden), {
      allowEmpty: false,
    });
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
  let resolved: ResolvedFilesPath | undefined;

  try {
    resolved = await resolveFilePath(input.path, Boolean(input.includeHidden), {
      allowEmpty: false,
    });
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

export async function createDirectoryEntry(
  params: CreateEntryParams,
): Promise<FileCreateResponse> {
  const includeHidden = Boolean(params.includeHidden);
  const name = ensureSafeName(params.name, includeHidden);
  let parentPath: ResolvedFilesPath | undefined;

  try {
    parentPath = await assertDirectoryPath(params.parentPath, includeHidden, {
      allowEmpty: true,
    });
    const relativePath = joinRelativePath(parentPath.segments, name);
    const targetPath = await resolveFilePath(relativePath, includeHidden, {
      allowEmpty: false,
      allowMissingLeaf: true,
    });

    if (targetPath.exists || (await pathExists(targetPath.absolutePath))) {
      throw new FileServiceError("Destination already exists", {
        code: "destination_exists",
        statusCode: 409,
      });
    }

    await mkdir(targetPath.absolutePath, {
      recursive: false,
    });

    return {
      root: targetPath.rootPath,
      path: targetPath.relativePath,
      type: "folder",
    };
  } catch (error) {
    throw mapFsError(error, "Failed to create folder", parentPath?.absolutePath);
  }
}

export async function createFileEntry(
  params: CreateEntryParams,
): Promise<FileCreateResponse> {
  const includeHidden = Boolean(params.includeHidden);
  const name = ensureSafeName(params.name, includeHidden);
  let parentPath: ResolvedFilesPath | undefined;

  try {
    parentPath = await assertDirectoryPath(params.parentPath, includeHidden, {
      allowEmpty: true,
    });
    const relativePath = joinRelativePath(parentPath.segments, name);
    const targetPath = await resolveFilePath(relativePath, includeHidden, {
      allowEmpty: false,
      allowMissingLeaf: true,
    });

    if (targetPath.exists || (await pathExists(targetPath.absolutePath))) {
      throw new FileServiceError("Destination already exists", {
        code: "destination_exists",
        statusCode: 409,
      });
    }

    await writeFile(targetPath.absolutePath, "", {
      encoding: "utf8",
      flag: "wx",
    });

    return {
      root: targetPath.rootPath,
      path: targetPath.relativePath,
      type: "file",
    };
  } catch (error) {
    throw mapFsError(error, "Failed to create file", parentPath?.absolutePath);
  }
}

async function movePath(
  sourceAbsolutePath: string,
  destinationAbsolutePath: string,
  isDirectory: boolean,
) {
  try {
    await rename(sourceAbsolutePath, destinationAbsolutePath);
    return;
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code !== "EXDEV") {
      throw error;
    }
  }

  if (isDirectory) {
    await cp(sourceAbsolutePath, destinationAbsolutePath, {
      recursive: true,
      force: false,
      errorOnExist: true,
    });
  } else {
    await copyFile(sourceAbsolutePath, destinationAbsolutePath);
  }
  await rm(sourceAbsolutePath, {
    recursive: true,
    force: true,
  });
}

export async function pasteEntry(params: PasteEntryParams): Promise<FilePasteResponse> {
  const includeHidden = Boolean(params.includeHidden);
  let sourcePath: ResolvedFilesPath | undefined;
  let destinationDirectory: ResolvedFilesPath | undefined;
  let targetPath: ResolvedFilesPath | undefined;

  try {
    sourcePath = await resolveFilePath(params.sourcePath, includeHidden, {
      allowEmpty: false,
    });
    const sourceInfo = await lstat(sourcePath.absolutePath);
    if (sourceInfo.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }
    if (!sourceInfo.isDirectory() && !sourceInfo.isFile()) {
      throw new FileServiceError("Unsupported file type", {
        code: "unsupported_file",
        statusCode: 415,
      });
    }

    destinationDirectory = await assertDirectoryPath(
      params.destinationPath,
      includeHidden,
      { allowEmpty: true },
    );
    const targetRelativePath = joinRelativePath(
      destinationDirectory.segments,
      path.basename(sourcePath.relativePath),
    );
    targetPath = await resolveFilePath(targetRelativePath, includeHidden, {
      allowEmpty: false,
      allowMissingLeaf: true,
    });

    if (targetPath.absolutePath === sourcePath.absolutePath) {
      throw new FileServiceError("Destination already exists", {
        code: "destination_exists",
        statusCode: 409,
      });
    }

    if (targetPath.exists || (await pathExists(targetPath.absolutePath))) {
      throw new FileServiceError("Destination already exists", {
        code: "destination_exists",
        statusCode: 409,
      });
    }

    if (
      params.operation === "move" &&
      sourceInfo.isDirectory() &&
      targetPath.relativePath.startsWith(`${sourcePath.relativePath}/`)
    ) {
      throw new FileServiceError("Cannot move folder into itself", {
        code: "invalid_path",
        statusCode: 400,
      });
    }

    if (params.operation === "copy") {
      await cp(sourcePath.absolutePath, targetPath.absolutePath, {
        recursive: sourceInfo.isDirectory(),
        force: false,
        errorOnExist: true,
      });
    } else {
      await movePath(
        sourcePath.absolutePath,
        targetPath.absolutePath,
        sourceInfo.isDirectory(),
      );
    }

    return {
      root: targetPath.rootPath,
      path: targetPath.relativePath,
      type: sourceInfo.isDirectory() ? "folder" : "file",
    };
  } catch (error) {
    throw mapFsError(
      error,
      `Failed to ${params.operation === "copy" ? "copy" : "move"} item`,
      targetPath?.absolutePath ?? destinationDirectory?.absolutePath ?? sourcePath?.absolutePath,
    );
  }
}

export async function renameEntry(params: RenameEntryParams): Promise<FileRenameResponse> {
  const includeHidden = Boolean(params.includeHidden);
  const newName = ensureSafeName(params.newName, includeHidden);
  let sourcePath: ResolvedFilesPath | undefined;
  let targetPath: ResolvedFilesPath | undefined;

  try {
    sourcePath = await resolveFilePath(params.path, includeHidden, {
      allowEmpty: false,
    });
    const sourceInfo = await lstat(sourcePath.absolutePath);
    if (sourceInfo.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }

    const parentRelativePath = sourcePath.segments.slice(0, -1).join("/");
    const nextRelativePath = joinRelativePath(
      parentRelativePath ? parentRelativePath.split("/") : [],
      newName,
    );
    targetPath = await resolveFilePath(nextRelativePath, includeHidden, {
      allowEmpty: false,
      allowMissingLeaf: true,
    });

    if (targetPath.absolutePath === sourcePath.absolutePath) {
      return {
        root: sourcePath.rootPath,
        oldPath: sourcePath.relativePath,
        path: sourcePath.relativePath,
        type: toEntryType(sourceInfo) ?? "file",
      };
    }

    if (targetPath.exists || (await pathExists(targetPath.absolutePath))) {
      throw new FileServiceError("Destination already exists", {
        code: "destination_exists",
        statusCode: 409,
      });
    }

    await rename(sourcePath.absolutePath, targetPath.absolutePath);
    const nextType = toEntryType(sourceInfo);
    if (!nextType) {
      throw new FileServiceError("Unsupported file type", {
        code: "unsupported_file",
        statusCode: 415,
      });
    }

    const wasStarred = await isPathStarredInDb(sourcePath.relativePath);
    if (wasStarred) {
      await setPathStarredInDb(sourcePath.relativePath, false);
      await setPathStarredInDb(targetPath.relativePath, true);
    }

    return {
      root: targetPath.rootPath,
      oldPath: sourcePath.relativePath,
      path: targetPath.relativePath,
      type: nextType,
    };
  } catch (error) {
    throw mapFsError(
      error,
      "Failed to rename item",
      targetPath?.absolutePath ?? sourcePath?.absolutePath,
    );
  }
}

export async function getEntryInfo(params: GetEntryInfoParams): Promise<FileInfoResponse> {
  const includeHidden = Boolean(params.includeHidden);
  let resolved: ResolvedFilesPath | undefined;

  try {
    resolved = await resolveFilePath(params.path, includeHidden, {
      allowEmpty: false,
    });
    const linkInfo = await lstat(resolved.absolutePath);
    if (linkInfo.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }

    const entryType = toEntryType(linkInfo);
    if (!entryType) {
      throw new FileServiceError("Unsupported file type", {
        code: "unsupported_file",
        statusCode: 415,
      });
    }

    const entryName = path.basename(resolved.absolutePath);
    const entryExt = entryType === "file" ? getExtension(entryName) : null;
    const starred = await isPathStarredInDb(resolved.relativePath);

    return {
      root: resolved.rootPath,
      path: resolved.relativePath,
      absolutePath: resolved.absolutePath,
      name: entryName,
      type: entryType,
      ext: entryExt,
      sizeBytes: linkInfo.size,
      modifiedAt: linkInfo.mtime.toISOString(),
      createdAt: linkInfo.birthtime.toISOString(),
      permissions: toPermissionsString(linkInfo.mode),
      starred,
    };
  } catch (error) {
    throw mapFsError(error, "Failed to get file info", resolved?.absolutePath);
  }
}

export async function toggleStarEntry(
  params: ToggleStarEntryParams,
): Promise<FileToggleStarResponse> {
  const includeHidden = Boolean(params.includeHidden);
  let resolved: ResolvedFilesPath | undefined;

  try {
    resolved = await resolveFilePath(params.path, includeHidden, {
      allowEmpty: false,
    });
    const linkInfo = await lstat(resolved.absolutePath);
    if (linkInfo.isSymbolicLink()) {
      throw new FileServiceError("Symlinks are not allowed", {
        code: "symlink_blocked",
        statusCode: 403,
      });
    }

    const entryType = toEntryType(linkInfo);
    if (!entryType) {
      throw new FileServiceError("Unsupported file type", {
        code: "unsupported_file",
        statusCode: 415,
      });
    }

    const currentlyStarred = await isPathStarredInDb(resolved.relativePath);
    const nextStarred = !currentlyStarred;
    await setPathStarredInDb(resolved.relativePath, nextStarred);

    return {
      path: resolved.relativePath,
      starred: nextStarred,
    };
  } catch (error) {
    throw mapFsError(error, "Failed to update star status", resolved?.absolutePath);
  }
}
