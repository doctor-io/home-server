"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { withClientTiming } from "@/lib/client/logger";
import type { StoreOperation, StoreOperationAction, StoreOperationEvent } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";
import {
  fetchStoreOperationSnapshot,
  subscribeToStoreOperationEvents,
} from "@/hooks/useStoreOperation";

type StartOperationResponse = {
  operationId: string;
};

type StartCustomOperationResponse = {
  appId: string;
  operationId: string;
};

type AppOperationState = {
  operationId: string;
  appId: string;
  action: StoreOperationAction;
  status: StoreOperation["status"];
  progressPercent: number;
  step: string;
  message: string | null;
};

function isTerminalStatus(status: StoreOperation["status"]) {
  return status === "success" || status === "error";
}

function mapOperationToState(operation: StoreOperation): AppOperationState {
  return {
    operationId: operation.id,
    appId: operation.appId,
    action: operation.action,
    status: operation.status,
    progressPercent: operation.progressPercent,
    step: operation.currentStep,
    message: operation.errorMessage,
  };
}

function mapEventToState(event: StoreOperationEvent): AppOperationState {
  return {
    operationId: event.operationId,
    appId: event.appId,
    action: event.action,
    status: event.status,
    progressPercent: event.progressPercent,
    step: event.step,
    message: event.message ?? null,
  };
}

async function startLifecycleRequest(
  endpoint: string,
  payload: Record<string, unknown>,
  action: string,
) {
  return withClientTiming(
    {
      layer: "hook",
      action,
      meta: {
        endpoint,
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed request (${response.status}) for ${endpoint}`);
      }

      return (await response.json()) as StartOperationResponse;
    },
  );
}

export function useStoreActions() {
  const queryClient = useQueryClient();
  const [operationsByApp, setOperationsByApp] = useState<Record<string, AppOperationState>>({});
  const streamCleanups = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const activeStreams = streamCleanups.current;

    return () => {
      for (const cleanup of activeStreams.values()) {
        cleanup();
      }
      activeStreams.clear();
    };
  }, []);

  const attachOperationTracking = useCallback(
    async (appId: string, operationId: string) => {
      const snapshot = await fetchStoreOperationSnapshot(operationId);
      if (snapshot) {
        setOperationsByApp((previous) => ({
          ...previous,
          [appId]: mapOperationToState(snapshot),
        }));
      }

      const cleanup = subscribeToStoreOperationEvents(operationId, {
        onEvent: (event) => {
          setOperationsByApp((previous) => ({
            ...previous,
            [event.appId]: mapEventToState(event),
          }));

          queryClient.setQueryData(
            queryKeys.storeOperation(event.operationId),
            (previous: StoreOperation | null | undefined) =>
              previous
                ? {
                    ...previous,
                    status: event.status,
                    progressPercent: event.progressPercent,
                    currentStep: event.step,
                    errorMessage: event.status === "error" ? (event.message ?? "Operation failed") : null,
                    updatedAt: event.timestamp,
                  }
                : null,
          );

          if (isTerminalStatus(event.status)) {
            cleanup();
            streamCleanups.current.delete(operationId);

            void Promise.all([
              queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog }),
              queryClient.invalidateQueries({ queryKey: queryKeys.storeApp(event.appId) }),
              queryClient.invalidateQueries({ queryKey: queryKeys.storeOperation(event.operationId) }),
            ]);
          }
        },
        onError: () => undefined,
      });

      streamCleanups.current.set(operationId, cleanup);
    },
    [queryClient],
  );

  const installMutation = useMutation({
    mutationFn: async (input: {
      appId: string;
      displayName?: string;
      env?: Record<string, string>;
      webUiPort?: number;
    }) => {
      const response = await startLifecycleRequest(
        `/api/v1/store/apps/${encodeURIComponent(input.appId)}/install`,
        {
          displayName: input.displayName,
          env: input.env,
          webUiPort: input.webUiPort,
        },
        "hooks.useStoreActions.install",
      );

      return {
        appId: input.appId,
        operationId: response.operationId,
      };
    },
    onSuccess: ({ appId, operationId }) => {
      void attachOperationTracking(appId, operationId);
    },
  });

  const redeployMutation = useMutation({
    mutationFn: async (input: {
      appId: string;
      env?: Record<string, string>;
      webUiPort?: number;
    }) => {
      const response = await startLifecycleRequest(
        `/api/v1/store/apps/${encodeURIComponent(input.appId)}/redeploy`,
        {
          env: input.env,
          webUiPort: input.webUiPort,
        },
        "hooks.useStoreActions.redeploy",
      );

      return {
        appId: input.appId,
        operationId: response.operationId,
      };
    },
    onSuccess: ({ appId, operationId }) => {
      void attachOperationTracking(appId, operationId);
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: async (input: {
      appId: string;
      removeVolumes?: boolean;
    }) => {
      const response = await startLifecycleRequest(
        `/api/v1/store/apps/${encodeURIComponent(input.appId)}/uninstall`,
        {
          removeVolumes: input.removeVolumes,
        },
        "hooks.useStoreActions.uninstall",
      );

      return {
        appId: input.appId,
        operationId: response.operationId,
      };
    },
    onSuccess: ({ appId, operationId }) => {
      void attachOperationTracking(appId, operationId);
    },
  });

  const installCustomMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      iconUrl?: string;
      webUiPort?: number;
      repositoryUrl?: string;
      sourceType: "docker-compose" | "docker-run";
      source: string;
    }) => {
      const response = await withClientTiming(
        {
          layer: "hook",
          action: "hooks.useStoreActions.installCustom",
          meta: {
            endpoint: "/api/v1/store/custom-apps/install",
            sourceType: input.sourceType,
          },
        },
        async () => {
          const result = await fetch("/api/v1/store/custom-apps/install", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(input),
          });

          if (!result.ok) {
            throw new Error(`Failed request (${result.status}) for /api/v1/store/custom-apps/install`);
          }

          return (await result.json()) as StartCustomOperationResponse;
        },
      );

      return response;
    },
    onSuccess: ({ appId, operationId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeApp(appId) });
      void attachOperationTracking(appId, operationId);
    },
  });

  return {
    operationsByApp,
    installApp: installMutation.mutateAsync,
    installCustomApp: installCustomMutation.mutateAsync,
    redeployApp: redeployMutation.mutateAsync,
    uninstallApp: uninstallMutation.mutateAsync,
  };
}

export type { AppOperationState };
