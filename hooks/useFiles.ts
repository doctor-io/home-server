"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type {
  FileListResponse,
  FileReadResponse,
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

type WriteFileApiResponse = {
  data: FileWriteResponse;
};

function buildListEndpoint(filePath: string) {
  const params = new URLSearchParams();
  if (filePath.length > 0) {
    params.set("path", filePath);
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

async function fetchDirectory(filePath: string) {
  const endpoint = buildListEndpoint(filePath);

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

export function useFilesDirectory(pathSegments: string[]) {
  const filePath = toFilePath(pathSegments);

  return useQuery({
    queryKey: queryKeys.filesList(filePath),
    queryFn: () => fetchDirectory(filePath),
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
        queryKey: queryKeys.filesList(getParentPath(variables.path)),
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
