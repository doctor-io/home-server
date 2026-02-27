"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type {
  CreateLocalFolderShareRequest,
  LocalFolderShareStatus,
} from "@/lib/shared/contracts/files";
import { queryKeys } from "@/lib/shared/query-keys";

type LocalFolderSharesResponse = {
  data: LocalFolderShareStatus[];
  meta?: {
    count: number;
  };
};

type LocalFolderShareResponse = {
  data: LocalFolderShareStatus;
};

type DeleteLocalFolderShareResponse = {
  data: {
    removed: boolean;
    id: string;
  };
};

function mapError(
  responseStatus: number,
  errorBody: { error?: string; code?: string },
) {
  return (
    errorBody.error ??
    `Request failed (${responseStatus})${errorBody.code ? ` [${errorBody.code}]` : ""}`
  );
}

async function listSharedFolders() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useLocalFolderShares.list",
    },
    async () => {
      const response = await fetch("/api/v1/files/shared/folders", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as LocalFolderSharesResponse;
      return json.data;
    },
  );
}

async function createSharedFolder(payload: CreateLocalFolderShareRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useLocalFolderShares.create",
      meta: {
        path: payload.path,
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/shared/folders", {
        method: "POST",
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
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as LocalFolderShareResponse;
      return json.data;
    },
  );
}

async function deleteSharedFolder(shareId: string) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useLocalFolderShares.delete",
      meta: {
        shareId,
      },
    },
    async () => {
      const response = await fetch(
        `/api/v1/files/shared/folders/${encodeURIComponent(shareId)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as DeleteLocalFolderShareResponse;
      return json.data;
    },
  );
}

function invalidateSharedFolderQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.localFolderShares,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.filesList("Shared"),
  });
}

export function useLocalFolderShares() {
  return useQuery({
    queryKey: queryKeys.localFolderShares,
    queryFn: listSharedFolders,
    staleTime: 5_000,
  });
}

export function useCreateLocalFolderShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSharedFolder,
    onSuccess: () => {
      invalidateSharedFolderQueries(queryClient);
    },
  });
}

export function useDeleteLocalFolderShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSharedFolder,
    onSuccess: () => {
      invalidateSharedFolderQueries(queryClient);
    },
  });
}
