import type {
  FileCreateRequest,
  FileCreateResponse,
  FileInfoResponse,
  FileListResponse,
  FilePasteCollision,
  FilePasteRequest,
  FilePasteResponse,
  FileReadResponse,
  FileRenameRequest,
  FileRenameResponse,
  FileRootResponse,
  FileToggleStarResponse,
  FileWriteRequest,
  FileWriteResponse,
} from "@/lib/shared/contracts/files";

export type { FilePasteCollision };

type ListFilesApiResponse = {
  data: FileListResponse;
  meta: {
    count: number;
  };
};

type ReadFileApiResponse = {
  data: FileReadResponse;
};

type RootFileApiResponse = {
  data: FileRootResponse;
};

type WriteFileApiResponse = {
  data: FileWriteResponse;
};

type FileCreateApiResponse = {
  data: FileCreateResponse;
};

type FilePasteApiResponse = {
  data: FilePasteResponse;
};

type FileRenameApiResponse = {
  data: FileRenameResponse;
};

type FileInfoApiResponse = {
  data: FileInfoResponse;
};

type FileToggleStarApiResponse = {
  data: FileToggleStarResponse;
};

export function buildListEndpoint(filePath: string, includeHidden = false) {
  const params = new URLSearchParams();
  if (filePath.length > 0) {
    params.set("path", filePath);
  }
  if (includeHidden) {
    params.set("includeHidden", "true");
  }
  const query = params.toString();
  return query.length > 0 ? `/api/v1/files?${query}` : "/api/v1/files";
}

export function buildReadEndpoint(filePath: string) {
  const params = new URLSearchParams({
    path: filePath,
  });
  return `/api/v1/files/content?${params.toString()}`;
}

export function getParentPath(filePath: string) {
  const normalized = filePath.trim();
  if (normalized.length === 0) return "";
  const separatorIndex = normalized.lastIndexOf("/");
  if (separatorIndex < 0) return "";
  return normalized.slice(0, separatorIndex);
}

export function toFilePath(pathSegments: string[]) {
  return pathSegments.join("/");
}

export function buildAssetUrl(filePath: string) {
  const params = new URLSearchParams({
    path: filePath,
  });
  return `/api/v1/files/asset?${params.toString()}`;
}

export function buildDownloadUrl(filePath: string) {
  const params = new URLSearchParams({
    path: filePath,
  });
  return `/api/v1/files/download?${params.toString()}`;
}

export function buildZipUrl(folderPath: string) {
  const params = new URLSearchParams({
    path: folderPath,
  });
  return `/api/v1/files/zip?${params.toString()}`;
}

type ErrorBody = {
  error?: string;
  code?: string;
};

async function getErrorBody(response: Response) {
  return (await response.json().catch(() => ({}))) as ErrorBody;
}

export async function fetchRoot() {
  const response = await fetch("/api/v1/files/root", {
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to fetch files root (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as RootFileApiResponse;
  return json.data;
}

export async function fetchFileContent(filePath: string) {
  const endpoint = buildReadEndpoint(filePath);

  const response = await fetch(endpoint, {
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to read file (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as ReadFileApiResponse;
  return json.data;
}

export async function saveFileContent(payload: FileWriteRequest) {
  const response = await fetch("/api/v1/files/content", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to save file (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as WriteFileApiResponse;
  return json.data;
}

export async function createFolder(payload: FileCreateRequest) {
  const response = await fetch("/api/v1/files/ops", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create_folder",
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to create folder (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as FileCreateApiResponse;
  return json.data;
}

export async function createFile(payload: FileCreateRequest) {
  const response = await fetch("/api/v1/files/ops", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create_file",
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to create file (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as FileCreateApiResponse;
  return json.data;
}

export async function pasteFile(payload: FilePasteRequest) {
  const response = await fetch("/api/v1/files/ops", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "paste",
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to paste (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as FilePasteApiResponse;
  return json.data;
}

export async function renameFile(payload: FileRenameRequest) {
  const response = await fetch("/api/v1/files/ops", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "rename",
      ...payload,
    }),
  });

  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to rename (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as FileRenameApiResponse;
  return json.data;
}

export async function getFileInfo(pathValue: string) {
  const response = await fetch("/api/v1/files/ops", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "get_info",
      path: pathValue,
    }),
  });

  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to read info (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as FileInfoApiResponse;
  return json.data;
}

export async function toggleStar(pathValue: string) {
  const response = await fetch("/api/v1/files/ops", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "toggle_star",
      path: pathValue,
    }),
  });

  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to toggle star (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as FileToggleStarApiResponse;
  return json.data;
}

export async function fetchDirectory(filePath: string, includeHidden: boolean) {
  const endpoint = buildListEndpoint(filePath, includeHidden);

  const response = await fetch(endpoint, {
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to list files (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }

  const json = (await response.json()) as ListFilesApiResponse;
  return json.data;
}

export async function fetchStarredFiles() {
  const response = await fetch("/api/v1/files/starred", {
    cache: "no-store",
  });
  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Failed to fetch starred items (${response.status})`,
    );
  }
  const json = (await response.json()) as ListFilesApiResponse;
  return json.data;
}

export async function uploadFilesToPath(payload: {
  destinationPath: string;
  files: File[];
  includeHidden?: boolean;
  onProgress?: (loaded: number, total: number) => void;
}) {
  const formData = new FormData();
  formData.append("path", payload.destinationPath);
  if (payload.includeHidden) formData.append("includeHidden", "true");
  for (const file of payload.files) {
    formData.append("file", file);
  }

  return new Promise<{ uploaded: { name: string; path: string; sizeBytes: number }[]; skipped: string[] }>(
    (resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/v1/files/upload");

      if (payload.onProgress) {
        const cb = payload.onProgress;
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) cb(e.loaded, e.total);
        });
      }

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const json = JSON.parse(xhr.responseText) as {
            data: { uploaded: { name: string; path: string; sizeBytes: number }[]; skipped: string[] };
          };
          resolve(json.data);
        } else {
          let errorMsg = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText) as ErrorBody;
            if (body.error) errorMsg = body.error;
          } catch { /* ignore */ }
          reject(new Error(errorMsg));
        }
      });

      xhr.addEventListener("error", () => reject(new Error("Upload failed: network error")));
      xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
      xhr.send(formData);
    },
  );
}

export async function searchFilesRequest(params: {
  query: string;
  basePath?: string;
  includeHidden?: boolean;
}) {
  const searchParams = new URLSearchParams({ q: params.query });
  if (params.basePath) searchParams.set("path", params.basePath);
  if (params.includeHidden) searchParams.set("includeHidden", "true");
  const endpoint = `/api/v1/files/search?${searchParams.toString()}`;

  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) {
    const errorBody = await getErrorBody(response);
    throw new Error(
      errorBody.error ??
        `Search failed (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
    );
  }
  const json = (await response.json()) as ListFilesApiResponse;
  return json.data;
}
