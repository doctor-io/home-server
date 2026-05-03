export type GoogleOAuthConfigPublic = {
  clientId: string;
  redirectUri: string;
  hasSecret: boolean;
};

export type DriveFileEntry = {
  id: string;
  name: string;
  mimeType: string;
  isFolder: boolean;
  size: number | null;
  modifiedAt: string | null;
  webViewLink: string | null;
  thumbnailLink: string | null;
};

export type DriveBrowseResponse = {
  connectionId: string;
  folderId: string;
  folderName: string | null;
  entries: DriveFileEntry[];
  nextPageToken: string | null;
};

export type DriveUploadedFile = { id: string; name: string };

export type DriveUploadResponse = { uploaded: DriveUploadedFile[] };

export type DriveFolderEntry = { id: string; name: string };
