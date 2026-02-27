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

type StartActionResult = {
  appId: string;
  operationId: string;
  action: StoreOperationAction;
};

type ErrorResponsePayload = {
  error?: string;
  code?: string;
};

const OPERATION_SNAPSHOT_POLL_MS = 1_500;

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

function toStoreActionErrorMessage(
  endpoint: string,
  status: number,
  payload: ErrorResponsePayload | null,
) {
  const baseMessage = payload?.error?.trim() || `Failed request (${status}) for ${endpoint}`;
  const code = payload?.code?.trim();
  if (!code) return baseMessage;
  return `${baseMessage} [${code}]`;
}

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as ErrorResponsePayload;
  } catch {
    return null;
  }
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
        const errorPayload = await parseErrorPayload(response);
        throw new Error(
          toStoreActionErrorMessage(endpoint, response.status, errorPayload),
        );
      }

      return (await response.json()) as StartOperationResponse;
    },
  );
}

export function useStoreActions() {
  const queryClient = useQueryClient();
  const [operationsByApp, setOperationsByApp] = useState<Record<string, AppOperationState>>({});
  const streamCleanups = useRef<Map<string, () => void>>(new Map());
  const pollCleanups = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    const activeStreams = streamCleanups.current;
    const activePolls = pollCleanups.current;

    return () => {
      for (const cleanup of activeStreams.values()) {
        cleanup();
      }
      activeStreams.clear();

      for (const cleanup of activePolls.values()) {
        cleanup();
      }
      activePolls.clear();
    };
  }, []);

  const attachOperationTracking = useCallback(
    async ({ appId, operationId, action }: StartActionResult) => {
      const existingStreamCleanup = streamCleanups.current.get(operationId);
      if (existingStreamCleanup) {
        existingStreamCleanup();
        streamCleanups.current.delete(operationId);
      }

      const existingPollCleanup = pollCleanups.current.get(operationId);
      if (existingPollCleanup) {
        existingPollCleanup();
        pollCleanups.current.delete(operationId);
      }

      setOperationsByApp((previous) => ({
        ...previous,
        [appId]: {
          operationId,
          appId,
          action,
          status: "queued",
          progressPercent: 0,
          step: "queued",
          message: null,
        },
      }));

      let streamCleanup: (() => void) | null = null;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false;

      const clearPollTimer = () => {
        if (pollTimer !== null) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
      };

      const stopTracking = () => {
        if (stopped) return;
        stopped = true;

        clearPollTimer();
        pollCleanups.current.delete(operationId);

        if (streamCleanup) {
          streamCleanup();
          streamCleanup = null;
        }
        streamCleanups.current.delete(operationId);
      };

      const invalidateTerminalState = (terminalAppId: string, terminalOperationId: string) => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog }),
          queryClient.invalidateQueries({ queryKey: queryKeys.installedApps }),
          queryClient.invalidateQueries({ queryKey: queryKeys.storeApp(terminalAppId) }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.appCompose(terminalAppId, "installed"),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.appCompose(terminalAppId, "catalog"),
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.storeOperation(terminalOperationId),
          }),
        ]);
      };

      const applySnapshotState = (snapshot: StoreOperation) => {
        if (stopped) return;

        const nextState = mapOperationToState(snapshot);

        setOperationsByApp((previous) => ({
          ...previous,
          [snapshot.appId]: nextState,
        }));

        queryClient.setQueryData(queryKeys.storeOperation(snapshot.id), snapshot);

        if (isTerminalStatus(snapshot.status)) {
          stopTracking();
          invalidateTerminalState(snapshot.appId, snapshot.id);
        }
      };

      const scheduleSnapshotPoll = () => {
        if (stopped) return;
        clearPollTimer();
        pollTimer = setTimeout(() => {
          void syncSnapshot();
        }, OPERATION_SNAPSHOT_POLL_MS);
      };

      const syncSnapshot = async () => {
        if (stopped) return;

        try {
          const snapshot = await fetchStoreOperationSnapshot(operationId);
          if (snapshot) {
            applySnapshotState(snapshot);
          }
        } catch {
          // Keep stream active; we'll retry on next poll.
        } finally {
          if (!stopped) {
            scheduleSnapshotPoll();
          }
        }
      };

      pollCleanups.current.set(operationId, () => {
        clearPollTimer();
      });

      try {
        await syncSnapshot();
      } catch {
        // Keep optimistic queued state and continue with SSE subscription.
      }

      if (stopped) {
        return;
      }

      streamCleanup = subscribeToStoreOperationEvents(operationId, {
        onEvent: (event) => {
          if (stopped) return;

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
            stopTracking();
            invalidateTerminalState(event.appId, event.operationId);
          }
        },
        onError: () => {
          if (stopped) return;
          void syncSnapshot();
        },
      });

      streamCleanups.current.set(operationId, () => {
        stopTracking();
      });
    },
    [queryClient],
  );

  const installMutation = useMutation({
    mutationFn: async (input: {
      appId: string;
      displayName?: string;
      env?: Record<string, string>;
      webUiPort?: number;
      composeSource?: string;
    }) => {
      const response = await startLifecycleRequest(
        `/api/v1/store/apps/${encodeURIComponent(input.appId)}/install`,
        {
          displayName: input.displayName,
          env: input.env,
          webUiPort: input.webUiPort,
          composeSource: input.composeSource,
        },
        "hooks.useStoreActions.install",
      );

      return {
        appId: input.appId,
        operationId: response.operationId,
        action: "install" as const,
      };
    },
    onSuccess: ({ appId, operationId, action }) => {
      void attachOperationTracking({
        appId,
        operationId,
        action,
      });
    },
  });

  const redeployMutation = useMutation({
    mutationFn: async (input: {
      appId: string;
      env?: Record<string, string>;
      webUiPort?: number;
      composeSource?: string;
    }) => {
      const response = await startLifecycleRequest(
        `/api/v1/store/apps/${encodeURIComponent(input.appId)}/redeploy`,
        {
          env: input.env,
          webUiPort: input.webUiPort,
          composeSource: input.composeSource,
        },
        "hooks.useStoreActions.redeploy",
      );

      return {
        appId: input.appId,
        operationId: response.operationId,
        action: "redeploy" as const,
      };
    },
    onSuccess: ({ appId, operationId, action }) => {
      void attachOperationTracking({
        appId,
        operationId,
        action,
      });
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
        action: "uninstall" as const,
      };
    },
    onSuccess: ({ appId, operationId, action }) => {
      void attachOperationTracking({
        appId,
        operationId,
        action,
      });
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
            const errorPayload = await parseErrorPayload(result);
            throw new Error(
              toStoreActionErrorMessage(
                "/api/v1/store/custom-apps/install",
                result.status,
                errorPayload,
              ),
            );
          }

          return (await result.json()) as StartCustomOperationResponse;
        },
      );

      return response;
    },
    onSuccess: ({ appId, operationId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeApp(appId) });
      void attachOperationTracking({
        appId,
        operationId,
        action: "install",
      });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (input: {
      appId: string;
      displayName?: string;
      iconUrl?: string | null;
      env?: Record<string, string>;
      webUiPort?: number;
      composeSource?: string;
    }) => {
      const response = await withClientTiming(
        {
          layer: "hook",
          action: "hooks.useStoreActions.saveSettings",
          meta: {
            endpoint: `/api/v1/store/apps/${input.appId}/settings`,
          },
        },
        async () => {
          const result = await fetch(
            `/api/v1/store/apps/${encodeURIComponent(input.appId)}/settings`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                displayName: input.displayName,
                iconUrl: input.iconUrl,
                env: input.env,
                webUiPort: input.webUiPort,
                composeSource: input.composeSource,
              }),
            },
          );

          if (!result.ok) {
            const errorPayload = await parseErrorPayload(result);
            throw new Error(
              toStoreActionErrorMessage(
                `/api/v1/store/apps/${input.appId}/settings`,
                result.status,
                errorPayload,
              ),
            );
          }

          return (await result.json()) as {
            saved: boolean;
            operationId?: string;
          };
        },
      );

      return { appId: input.appId, ...response };
    },
    onSuccess: ({ appId, operationId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog });
      void queryClient.invalidateQueries({ queryKey: queryKeys.installedApps });
      void queryClient.invalidateQueries({ queryKey: queryKeys.storeApp(appId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.appCompose(appId, "installed"),
      });

      if (operationId) {
        void attachOperationTracking({
          appId,
          operationId,
          action: "redeploy",
        });
      }
    },
  });

  return {
    operationsByApp,
    installApp: installMutation.mutateAsync,
    installCustomApp: installCustomMutation.mutateAsync,
    redeployApp: redeployMutation.mutateAsync,
    uninstallApp: uninstallMutation.mutateAsync,
    saveAppSettings: saveSettingsMutation.mutateAsync,
  };
}

export type { AppOperationState };
