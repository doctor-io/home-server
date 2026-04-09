"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileReadResponse } from "@/lib/shared/contracts/files";
import { queryKeys } from "@/lib/shared/query-keys";
import {
  createFile,
  createFolder,
  fetchDirectory,
  fetchFileContent,
  fetchRoot,
  fetchStarredFiles,
  getFileInfo,
  getParentPath,
  pasteFile,
  renameFile,
  searchFilesRequest,
  saveFileContent,
  toFilePath,
  toggleStar,
  uploadFilesToPath,
} from "@/modules/files/hooks/files-api";

export { buildAssetUrl, buildDownloadUrl, buildZipUrl, toFilePath } from "@/modules/files/hooks/files-api";
export type { FilePasteCollision } from "@/modules/files/hooks/files-api";

export function useFilesRoot() {
  return useQuery({
    queryKey: queryKeys.filesRoot,
    queryFn: fetchRoot,
    staleTime: 5_000,
  });
}

export function useFilesDirectory(
  pathSegments: string[],
  includeHidden = false,
  options: { enabled?: boolean } = {},
) {
  const filePath = toFilePath(pathSegments);

  return useQuery({
    queryKey: queryKeys.filesList(filePath, includeHidden),
    queryFn: () => fetchDirectory(filePath, includeHidden),
    staleTime: 3_000,
    enabled: options.enabled !== false,
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
      queryClient.setQueryData(queryKeys.fileContent(variables.path), (
        prev: { data: FileReadResponse } | FileReadResponse | undefined,
      ) => {
        const previous =
          prev && "data" in prev
            ? prev.data
            : (prev as FileReadResponse | undefined);

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
      void queryClient.invalidateQueries({ queryKey: queryKeys.filesStarred });
    },
  });
}

export function useStarredFiles() {
  return useQuery({
    queryKey: queryKeys.filesStarred,
    queryFn: fetchStarredFiles,
    staleTime: 5_000,
  });
}

export function useSearchFiles(params: {
  query: string;
  basePath?: string;
  includeHidden?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.filesSearch(
      params.query,
      params.basePath ?? "",
      params.includeHidden ?? false,
    ),
    queryFn: () =>
      searchFilesRequest({
        query: params.query,
        basePath: params.basePath,
        includeHidden: params.includeHidden,
      }),
    enabled: Boolean(params.enabled) && params.query.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function useUploadFiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadFilesToPath,
    onSuccess: (_data, variables) => {
      invalidateFileListPath(queryClient, variables.destinationPath);
    },
  });
}

