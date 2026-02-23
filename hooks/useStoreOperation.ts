"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { logClientAction, withClientTiming } from "@/lib/client/logger";
import type { StoreOperation, StoreOperationEvent } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";

type StoreOperationResponse = {
  data: StoreOperation;
};

type StoreOperationSubscriptionOptions = {
  onEvent?: (event: StoreOperationEvent) => void;
  onError?: (error: unknown) => void;
};

function isTerminalStatus(status: string) {
  return status === "success" || status === "error";
}

function eventToOperation(
  event: StoreOperationEvent,
  previous: StoreOperation | null | undefined,
): StoreOperation {
  return {
    id: event.operationId,
    appId: event.appId,
    action: event.action,
    status: event.status,
    progressPercent: event.progressPercent,
    currentStep: event.step,
    errorMessage:
      event.status === "error"
        ? (event.message ?? previous?.errorMessage ?? "Operation failed")
        : null,
    startedAt: previous?.startedAt ?? event.timestamp,
    finishedAt:
      event.status === "success" || event.status === "error"
        ? event.timestamp
        : previous?.finishedAt ?? null,
    updatedAt: event.timestamp,
  };
}

export async function fetchStoreOperationSnapshot(operationId: string) {
  const endpoint = `/api/v1/store/operations/${encodeURIComponent(operationId)}`;

  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useStoreOperation.fetch",
      meta: {
        endpoint,
        operationId,
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch store operation (${response.status})`);
      }

      const json = (await response.json()) as StoreOperationResponse;
      return json.data;
    },
  );
}

export function subscribeToStoreOperationEvents(
  operationId: string,
  options?: StoreOperationSubscriptionOptions,
) {
  const endpoint = `/api/v1/store/operations/${encodeURIComponent(operationId)}/stream`;
  const source = new EventSource(endpoint);

  const eventTypes: StoreOperationEvent["type"][] = [
    "operation.started",
    "operation.step",
    "operation.pull.progress",
    "operation.completed",
    "operation.failed",
  ];

  const listeners: Array<{
    type: string;
    listener: EventListener;
  }> = [];

  for (const type of eventTypes) {
    const listener: EventListener = (rawEvent) => {
      const event = rawEvent as MessageEvent<string>;
      try {
        const payload = JSON.parse(event.data) as StoreOperationEvent;
        options?.onEvent?.(payload);
      } catch (error) {
        options?.onError?.(error);
      }
    };

    source.addEventListener(type, listener);
    listeners.push({ type, listener });
  }

  source.addEventListener("error", (error) => {
    options?.onError?.(error);
  });

  return () => {
    listeners.forEach(({ type, listener }) => {
      source.removeEventListener(type, listener);
    });
    source.close();
  };
}

export function useStoreOperation(operationId: string | null) {
  const queryClient = useQueryClient();
  const [latestEvent, setLatestEvent] = useState<StoreOperationEvent | null>(null);

  const snapshotQuery = useQuery({
    queryKey: operationId ? queryKeys.storeOperation(operationId) : ["store", "operation", "none"],
    queryFn: () => fetchStoreOperationSnapshot(operationId as string),
    enabled: Boolean(operationId),
    staleTime: 1_000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && isTerminalStatus(status) ? false : 1_500;
    },
  });

  useEffect(() => {
    if (!operationId) {
      setLatestEvent(null);
      return;
    }

    const unsubscribe = subscribeToStoreOperationEvents(operationId, {
      onEvent: (event) => {
        setLatestEvent(event);

        queryClient.setQueryData<StoreOperation | null>(
          queryKeys.storeOperation(operationId),
          (previous) => eventToOperation(event, previous),
        );

        if (isTerminalStatus(event.status)) {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog }),
            queryClient.invalidateQueries({ queryKey: queryKeys.storeApp(event.appId) }),
            queryClient.invalidateQueries({ queryKey: queryKeys.storeOperation(operationId) }),
          ]);
        }
      },
      onError: (error) => {
        logClientAction({
          level: "error",
          layer: "hook",
          action: "hooks.useStoreOperation.stream",
          status: "error",
          meta: {
            operationId,
          },
          error,
        });
      },
    });

    logClientAction({
      layer: "hook",
      action: "hooks.useStoreOperation.stream",
      status: "start",
      meta: {
        operationId,
      },
    });

    return () => {
      unsubscribe();
      logClientAction({
        layer: "hook",
        action: "hooks.useStoreOperation.stream",
        status: "info",
        meta: {
          operationId,
        },
      });
    };
  }, [operationId, queryClient]);

  const operation = useMemo(() => {
    if (!snapshotQuery.data) {
      return latestEvent ? eventToOperation(latestEvent, null) : null;
    }

    if (!latestEvent) return snapshotQuery.data;
    return eventToOperation(latestEvent, snapshotQuery.data);
  }, [latestEvent, snapshotQuery.data]);

  return {
    operation,
    latestEvent,
    isLoading: snapshotQuery.isLoading,
    isError: snapshotQuery.isError,
    error: snapshotQuery.error,
  };
}
