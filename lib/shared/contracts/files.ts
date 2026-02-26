export type FileServiceErrorCode =
  | "invalid_path"
  | "path_outside_root"
  | "not_found"
  | "not_a_file"
  | "not_a_directory"
  | "hidden_blocked"
  | "symlink_blocked"
  | "unsupported_file"
  | "payload_too_large"
  | "write_conflict"
  | "internal_error";

export type FileEntryType = "folder" | "file";

export type FileReadMode =
  | "text"
  | "image"
  | "pdf"
  | "binary_unsupported"
  | "too_large";

export type FileListEntry = {
  name: string;
  path: string;
  type: FileEntryType;
  ext: string | null;
  sizeBytes: number | null;
  modifiedAt: string;
  mtimeMs: number;
};

export type FileListResponse = {
  root: string;
  cwd: string;
  entries: FileListEntry[];
};

export type FileReadResponse = {
  root: string;
  path: string;
  name: string;
  ext: string | null;
  mode: FileReadMode;
  mimeType: string | null;
  sizeBytes: number;
  modifiedAt: string;
  mtimeMs: number;
  content: string | null;
};

export type FileWriteRequest = {
  path: string;
  content: string;
  expectedMtimeMs?: number;
};

export type FileWriteResponse = {
  root: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  mtimeMs: number;
};
