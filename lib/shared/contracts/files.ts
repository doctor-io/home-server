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
  | "share_exists"
  | "share_not_found"
  | "mount_failed"
  | "unmount_failed"
  | "trash_meta_missing"
  | "destination_exists"
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

export type NetworkShare = {
  id: string;
  host: string;
  share: string;
  username: string;
  mountPath: string;
};

export type NetworkShareStatus = NetworkShare & {
  isMounted: boolean;
};

export type CreateNetworkShareRequest = {
  host: string;
  share: string;
  username: string;
  password: string;
};

export type DiscoverServersResponse = {
  servers: string[];
};

export type DiscoverSharesRequest = {
  host: string;
  username: string;
  password: string;
};

export type DiscoverSharesResponse = {
  shares: string[];
};

export type TrashMoveRequest = {
  path: string;
};

export type TrashMoveResponse = {
  trashPath: string;
  originalPath: string;
};

export type TrashRestoreRequest = {
  path: string;
  collision?: "keep-both" | "replace" | "fail";
};

export type TrashRestoreResponse = {
  restoredPath: string;
  sourceTrashPath: string;
};

export type TrashDeleteRequest = {
  path: string;
};
