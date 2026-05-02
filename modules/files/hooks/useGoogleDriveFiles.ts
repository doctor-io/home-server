"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/shared/query-keys";
import type { DriveBrowseResponse, DriveFileEntry, DriveUploadResponse } from "@/lib/shared/contracts/google-drive";

type ApiResponse<T> = { data: T };
type ApiError = { error?: string; code?: string };

function mapError(status: number, body: ApiError) {
  return body.error ?? `Request failed (${status})${body.code ? ` [${body.code}]` : ""}`;
}

async function fetchDriveBrowse(
  connectionId: string,
  folderId: string,
): Promise<DriveBrowseResponse> {
  const params = new URLSearchParams({ folderId });
  const res = await fetch(
    `/api/v1/files/google-drive/${encodeURIComponent(connectionId)}/browse?${params.toString()}`,
    { cache: "no-store" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(mapError(res.status, body));
  }
  const json = (await res.json()) as ApiResponse<DriveBrowseResponse>;
  return json.data;
}

async function deleteDriveFile(connectionId: string, fileId: string): Promise<void> {
  const res = await fetch(
    `/api/v1/files/google-drive/${encodeURIComponent(connectionId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(mapError(res.status, body));
  }
}

async function createDriveFolder(
  connectionId: string,
  parentId: string,
  name: string,
): Promise<DriveFileEntry> {
  const res = await fetch(
    `/api/v1/files/google-drive/${encodeURIComponent(connectionId)}/folders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, name }),
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(mapError(res.status, body));
  }
  const json = (await res.json()) as ApiResponse<DriveFileEntry>;
  return json.data;
}

async function uploadDriveFiles(
  connectionId: string,
  folderId: string,
  files: File[],
  onProgress?: (loaded: number, total: number) => void,
): Promise<DriveUploadResponse> {
  const formData = new FormData();
  formData.append("folderId", folderId);
  let totalSize = 0;
  for (const file of files) {
    formData.append("file", file);
    totalSize += file.size;
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/v1/files/google-drive/${encodeURIComponent(connectionId)}/upload`);

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
        else onProgress(0, totalSize);
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as ApiResponse<DriveUploadResponse>;
          resolve(json.data);
        } catch {
          reject(new Error("Invalid response from upload"));
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as ApiError;
          reject(new Error(mapError(xhr.status, body)));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.send(formData);
  });
}

export function buildDriveDownloadUrl(
  connectionId: string,
  fileId: string,
  name: string,
  mimeType: string,
): string {
  const params = new URLSearchParams({ fileId, name, mimeType });
  return `/api/v1/files/google-drive/${encodeURIComponent(connectionId)}/download?${params.toString()}`;
}

export function useGoogleDriveFiles(connectionId: string, folderId: string) {
  return useQuery({
    queryKey: queryKeys.googleDriveBrowse(connectionId, folderId),
    queryFn: () => fetchDriveBrowse(connectionId, folderId),
    staleTime: 10_000,
    enabled: Boolean(connectionId),
  });
}

export function useGoogleDriveDeleteFile(connectionId: string, folderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => deleteDriveFile(connectionId, fileId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.googleDriveBrowse(connectionId, folderId),
      });
    },
  });
}

export function useGoogleDriveCreateFolder(connectionId: string, folderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, name }: { parentId: string; name: string }) =>
      createDriveFolder(connectionId, parentId, name),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.googleDriveBrowse(connectionId, folderId),
      });
    },
  });
}

export function useGoogleDriveUpload(connectionId: string, folderId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      files,
      onProgress,
    }: {
      files: File[];
      onProgress?: (loaded: number, total: number) => void;
    }) => uploadDriveFiles(connectionId, folderId, files, onProgress),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.googleDriveBrowse(connectionId, folderId),
      });
    },
  });
}
