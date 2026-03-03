"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type {
  FileCreateRequest,
  FileCreateResponse,
  FileInfoResponse,
  FileListResponse,
  FilePasteRequest,
  FilePasteResponse,
  FileRenameRequest,
  FileRenameResponse,
  FileRootResponse,
  FileReadResponse,
  FileToggleStarResponse,
  FileWriteRequest,
  FileWriteResponse,
} from "@/lib/shared/contracts/files";
import { queryKeys } from "@/lib/shared/query-keys";

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

function buildListEndpoint(filePath: string, includeHidden = false) {
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

function buildReadEndpoint(filePath: string) {
  const params = new URLSearchParams({
    path: filePath,
  });
  return `/api/v1/files/content?${params.toString()}`;
}

function getParentPath(filePath: string) {
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

async function fetchRoot() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.fetchRoot",
      meta: {
        endpoint: "/api/v1/files/root",
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/root", {
        cache: "no-store",
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to fetch files root (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as RootFileApiResponse;
      return json.data;
    },
  );
}

async function fetchFileContent(filePath: string) {
  const endpoint = buildReadEndpoint(filePath);

  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.fetchContent",
      meta: {
        endpoint,
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to read file (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as ReadFileApiResponse;
      return json.data;
    },
  );
}

async function saveFileContent(payload: FileWriteRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.saveContent",
      meta: {
        endpoint: "/api/v1/files/content",
        path: payload.path,
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/content", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to save file (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as WriteFileApiResponse;
      return json.data;
    },
  );
}

async function createFolder(payload: FileCreateRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.createFolder",
      meta: {
        endpoint: "/api/v1/files/ops",
        parentPath: payload.parentPath,
      },
    },
    async () => {
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
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to create folder (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as FileCreateApiResponse;
      return json.data;
    },
  );
}

async function createFile(payload: FileCreateRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.createFile",
      meta: {
        endpoint: "/api/v1/files/ops",
        parentPath: payload.parentPath,
      },
    },
    async () => {
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
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to create file (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as FileCreateApiResponse;
      return json.data;
    },
  );
}

async function pasteFile(payload: FilePasteRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.paste",
      meta: {
        endpoint: "/api/v1/files/ops",
        sourcePath: payload.sourcePath,
        destinationPath: payload.destinationPath,
        operation: payload.operation,
      },
    },
    async () => {
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
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to paste (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as FilePasteApiResponse;
      return json.data;
    },
  );
}

async function renameFile(payload: FileRenameRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.rename",
      meta: {
        endpoint: "/api/v1/files/ops",
        path: payload.path,
      },
    },
    async () => {
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
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to rename (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as FileRenameApiResponse;
      return json.data;
    },
  );
}

async function getFileInfo(pathValue: string) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.getInfo",
      meta: {
        endpoint: "/api/v1/files/ops",
        path: pathValue,
      },
    },
    async () => {
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
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to read info (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as FileInfoApiResponse;
      return json.data;
    },
  );
}

async function toggleStar(pathValue: string) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.toggleStar",
      meta: {
        endpoint: "/api/v1/files/ops",
        path: pathValue,
      },
    },
    async () => {
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
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to toggle star (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as FileToggleStarApiResponse;
      return json.data;
    },
  );
}

export function useFilesRoot() {
  return useQuery({
    queryKey: queryKeys.filesRoot,
    queryFn: fetchRoot,
    staleTime: 5_000,
  });
}

async function fetchDirectoryWithHidden(filePath: string, includeHidden: boolean) {
  const endpoint = buildListEndpoint(filePath, includeHidden);

  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useFiles.fetchDirectory",
      meta: {
        endpoint,
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });
      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(
          errorBody.error ??
            `Failed to list files (${response.status})${errorBody.code ? ` [${errorBody.code}]` : ""}`,
        );
      }

      const json = (await response.json()) as ListFilesApiResponse;
      return json.data;
    },
  );
}

export function useFilesDirectory(pathSegments: string[], includeHidden = false) {
  const filePath = toFilePath(pathSegments);

  return useQuery({
    queryKey: queryKeys.filesList(filePath, includeHidden),
    queryFn: () => fetchDirectoryWithHidden(filePath, includeHidden),
    staleTime: 3_000,
  });
}

export function useFileContent(filePath: string | null) {
  return useQuery({
    queryKey: queryKeys.fileContent(filePath ?? ""),
    queryFn: () => fetchFileContent(filePath ?? ""),
    enabled: Boolean(filePath),
    staleTime: 0,
  });
}

export function useSaveFileContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveFileContent,
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(variables.path),
      });
      void queryClient.invalidateQueries({
        queryKey: ["files", "list", getParentPath(variables.path)],
      });
      queryClient.setQueryData(queryKeys.fileContent(variables.path), (prev: ReadFileApiResponse | FileReadResponse | undefined) => {
        const previous =
          prev && "data" in prev ? (prev.data as FileReadResponse) : (prev as FileReadResponse | undefined);

        if (!previous || previous.mode !== "text") return previous;

        return {
          ...previous,
          content: variables.content,
          mtimeMs: data.mtimeMs,
          modifiedAt: data.modifiedAt,
          sizeBytes: data.sizeBytes,
        } satisfies FileReadResponse;
      });
    },
  });
}

function invalidateFileListPath(queryClient: ReturnType<typeof useQueryClient>, filePath: string) {
  void queryClient.invalidateQueries({
    queryKey: ["files", "list", filePath],
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFolder,
    onSuccess: (_, variables) => {
      invalidateFileListPath(queryClient, variables.parentPath);
    },
  });
}

export function useCreateFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createFile,
    onSuccess: (_, variables) => {
      invalidateFileListPath(queryClient, variables.parentPath);
    },
  });
}

export function usePasteFileEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pasteFile,
    onSuccess: (_, variables) => {
      invalidateFileListPath(queryClient, variables.destinationPath);
      invalidateFileListPath(queryClient, getParentPath(variables.sourcePath));
      if (variables.operation === "move") {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.fileContent(variables.sourcePath),
        });
      }
    },
  });
}

export function useRenameFileEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: renameFile,
    onSuccess: (data, variables) => {
      invalidateFileListPath(queryClient, getParentPath(variables.path));
      if (getParentPath(variables.path) !== getParentPath(data.path)) {
        invalidateFileListPath(queryClient, getParentPath(data.path));
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(variables.path),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(data.path),
      });
    },
  });
}

export function useFileEntryInfo() {
  return useMutation({
    mutationFn: getFileInfo,
  });
}

export function useToggleFileStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleStar,
    onSuccess: (_data, pathValue) => {
      invalidateFileListPath(queryClient, getParentPath(pathValue));
    },
  });
}
