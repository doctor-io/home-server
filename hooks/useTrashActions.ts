"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type {
  TrashEmptyResponse,
  TrashDeleteRequest,
  TrashMoveRequest,
  TrashMoveResponse,
  TrashRestoreRequest,
  TrashRestoreResponse,
} from "@/lib/shared/contracts/files";
import { queryKeys } from "@/lib/shared/query-keys";

type TrashMoveApiResponse = {
  data: TrashMoveResponse;
};

type TrashRestoreApiResponse = {
  data: TrashRestoreResponse;
};

type TrashDeleteApiResponse = {
  data: {
    deleted: boolean;
    path: string;
  };
};

type TrashEmptyApiResponse = {
  data: TrashEmptyResponse;
};

function mapError(responseStatus: number, errorBody: { error?: string; code?: string }) {
  return (
    errorBody.error ??
    `Request failed (${responseStatus})${errorBody.code ? ` [${errorBody.code}]` : ""}`
  );
}

function getParentPath(filePath: string) {
  const normalized = filePath.trim();
  if (normalized.length === 0) return "";
  const separatorIndex = normalized.lastIndexOf("/");
  if (separatorIndex < 0) return "";
  return normalized.slice(0, separatorIndex);
}

function filesListKeyPrefix(filePath: string) {
  return ["files", "list", filePath] as const;
}

async function moveToTrash(payload: TrashMoveRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useTrashActions.move",
      meta: {
        path: payload.path,
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/trash/move", {
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

      const json = (await response.json()) as TrashMoveApiResponse;
      return json.data;
    },
  );
}

async function restoreFromTrash(payload: TrashRestoreRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useTrashActions.restore",
      meta: {
        path: payload.path,
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/trash/restore", {
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

      const json = (await response.json()) as TrashRestoreApiResponse;
      return json.data;
    },
  );
}

async function deleteFromTrash(payload: TrashDeleteRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useTrashActions.delete",
      meta: {
        path: payload.path,
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/trash/delete", {
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

      const json = (await response.json()) as TrashDeleteApiResponse;
      return json.data;
    },
  );
}

async function emptyTrashRequest() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useTrashActions.empty",
      meta: {
        endpoint: "/api/v1/files/trash/empty",
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/trash/empty", {
        method: "POST",
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as TrashEmptyApiResponse;
      return json.data;
    },
  );
}

export function useMoveToTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveToTrash,
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: filesListKeyPrefix(getParentPath(variables.path)),
      });
      void queryClient.invalidateQueries({
        queryKey: filesListKeyPrefix("Trash"),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(variables.path),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.trashEntries("Trash"),
      });
      void queryClient.invalidateQueries({
        queryKey: filesListKeyPrefix(getParentPath(data.trashPath)),
      });
    },
  });
}

export function useRestoreFromTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreFromTrash,
    onSuccess: (data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: filesListKeyPrefix("Trash"),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.trashEntries("Trash"),
      });
      void queryClient.invalidateQueries({
        queryKey: filesListKeyPrefix(getParentPath(data.restoredPath)),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(variables.path),
      });
    },
  });
}

export function useDeleteFromTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteFromTrash,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: filesListKeyPrefix(getParentPath(variables.path)),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.trashEntries("Trash"),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fileContent(variables.path),
      });
    },
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: emptyTrashRequest,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: filesListKeyPrefix("Trash"),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.trashEntries("Trash"),
      });
    },
  });
}
