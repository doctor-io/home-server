import "server-only";

import { getAccessToken, GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import type { DriveFileEntry, DriveBrowseResponse, DriveUploadedFile } from "@/lib/shared/contracts/google-drive";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

const FILE_FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveApiFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
};

type DriveApiError = { error?: { message?: string } };

function mapEntry(file: DriveApiFile): DriveFileEntry {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    isFolder: file.mimeType === FOLDER_MIME,
    size: file.size != null ? parseInt(file.size, 10) : null,
    modifiedAt: file.modifiedTime ?? null,
    webViewLink: file.webViewLink ?? null,
    thumbnailLink: file.thumbnailLink ?? null,
  };
}

async function assertOk(res: Response, label: string): Promise<void> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as DriveApiError;
    throw new GoogleDriveError(
      body.error?.message ?? `${label}: ${res.status}`,
      "api_error",
      res.status,
    );
  }
}

export async function listDriveFiles(
  connectionId: string,
  folderId: string,
  pageToken?: string,
): Promise<DriveBrowseResponse> {
  const token = await getAccessToken(connectionId);

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: `nextPageToken,files(${FILE_FIELDS})`,
    orderBy: "folder,name",
    pageSize: "100",
  });
  if (pageToken) params.set("pageToken", pageToken);

  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await assertOk(res, "Drive list");

  const body = (await res.json()) as { files: DriveApiFile[]; nextPageToken?: string };

  let folderName: string | null = null;
  if (folderId !== "root") {
    try {
      const metaRes = await fetch(
        `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,name`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (metaRes.ok) {
        const meta = (await metaRes.json()) as { name?: string };
        folderName = meta.name ?? null;
      }
    } catch {
      // non-fatal — breadcrumb name just shows as null
    }
  }

  return {
    connectionId,
    folderId,
    folderName,
    entries: (body.files ?? []).map(mapEntry),
    nextPageToken: body.nextPageToken ?? null,
  };
}

export async function downloadDriveFile(
  connectionId: string,
  fileId: string,
): Promise<Response> {
  const token = await getAccessToken(connectionId);
  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new GoogleDriveError(`Failed to download file: ${res.status}`, "api_error", res.status);
  }
  return res;
}

export async function uploadToDrive(
  connectionId: string,
  folderId: string,
  filename: string,
  mimeType: string,
  body: ReadableStream,
): Promise<DriveUploadedFile> {
  const token = await getAccessToken(connectionId);

  // Initiate resumable upload session
  const initRes = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=resumable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": mimeType,
    },
    body: JSON.stringify({ name: filename, parents: [folderId] }),
  });

  if (!initRes.ok) {
    const err = (await initRes.json().catch(() => ({}))) as DriveApiError;
    throw new GoogleDriveError(
      err.error?.message ?? `Failed to initiate upload: ${initRes.status}`,
      "api_error",
    );
  }

  const uploadUri = initRes.headers.get("Location");
  if (!uploadUri) throw new GoogleDriveError("No upload URI returned from Drive", "api_error");

  const uploadRes = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      Authorization: `Bearer ${token}`,
    },
    body,
    duplex: "half",
  } as RequestInit);

  if (!uploadRes.ok) {
    throw new GoogleDriveError(`Drive upload failed: ${uploadRes.status}`, "api_error");
  }

  const result = (await uploadRes.json()) as { id: string; name: string };
  return { id: result.id, name: result.name };
}

export async function createDriveFolder(
  connectionId: string,
  parentId: string,
  name: string,
): Promise<DriveFileEntry> {
  const token = await getAccessToken(connectionId);

  const res = await fetch(`${DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  await assertOk(res, "Drive create folder");

  return mapEntry((await res.json()) as DriveApiFile);
}

export async function deleteDriveFile(connectionId: string, fileId: string): Promise<void> {
  const token = await getAccessToken(connectionId);

  const res = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 204) {
    throw new GoogleDriveError(`Failed to delete file: ${res.status}`, "api_error", res.status);
  }
}
