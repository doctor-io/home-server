export type FileServiceErrorCode =
  | "invalid_path"
  | "path_outside_root"
  | "not_found"
  | "not_a_file"
  | "not_a_directory"
  | "hidden_blocked"
  | "symlink_blocked"
  | "permission_denied"
  | "operation_conflict"
  | "container_not_found"
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
  starred?: boolean;
};

export type FileListResponse = {
  root: string;
  cwd: string;
  entries: FileListEntry[];
};

export type FileRootResponse = {
  rootPath: string;
  effectiveUid: number | null;
  effectiveGid: number | null;
  writable: boolean;
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

export type FileCreateRequest = {
  parentPath: string;
  name: string;
};

export type FileCreateResponse = {
  root: string;
  path: string;
  type: FileEntryType;
};

export type FileRenameRequest = {
  path: string;
  newName: string;
};

export type FileRenameResponse = {
  root: string;
  oldPath: string;
  path: string;
  type: FileEntryType;
};

export type FileInfoResponse = {
  root: string;
  path: string;
  absolutePath: string;
  name: string;
  type: FileEntryType;
  ext: string | null;
  sizeBytes: number;
  modifiedAt: string;
  createdAt: string;
  permissions: string;
  starred: boolean;
};

export type FileToggleStarResponse = {
  path: string;
  starred: boolean;
};

export type FilePasteOperation = "copy" | "move";

export type FilePasteRequest = {
  sourcePath: string;
  destinationPath: string;
  operation: FilePasteOperation;
};

export type FilePasteResponse = {
  root: string;
  path: string;
  type: FileEntryType;
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

export type LocalFolderShareStatus = {
  id: string;
  shareName: string;
  sourcePath: string;
  sharedPath: string;
  isMounted: boolean;
  isExported: boolean;
};

export type CreateLocalFolderShareRequest = {
  path: string;
  name?: string;
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

export type TrashEmptyResponse = {
  deletedCount: number;
};
