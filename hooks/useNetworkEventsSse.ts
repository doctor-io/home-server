"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { logClientAction } from "@/lib/client/logger";
import { queryKeys } from "@/lib/shared/query-keys";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useNetworkEventsSse(enabled = true) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>(
    enabled ? "connecting" : "disconnected",
  );

  useEffect(() => {
    if (!enabled) {
      setStatus("disconnected");
      return;
    }

    const connectedAt = performance.now();

    logClientAction({
      layer: "hook",
      action: "hooks.useNetworkEventsSse.connection",
      status: "start",
      meta: {
        endpoint: "/api/v1/network/events/stream",
      },
    });

    const source = new EventSource("/api/v1/network/events/stream");

    source.onopen = () => {
      setStatus("connected");
      logClientAction({
        layer: "hook",
        action: "hooks.useNetworkEventsSse.connection",
        status: "success",
        durationMs: Number((performance.now() - connectedAt).toFixed(2)),
      });
    };

    const refreshCachedQueries = () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.networkStatus,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.networkNetworks,
        }),
      ]);
    };

    const onConnectionChanged = () => {
      refreshCachedQueries();
    };

    const onDeviceStateChanged = () => {
      refreshCachedQueries();
    };

    const onError = () => {
      setStatus("disconnected");
      logClientAction({
        level: "warn",
        layer: "hook",
        action: "hooks.useNetworkEventsSse.connection",
        status: "error",
        durationMs: Number((performance.now() - connectedAt).toFixed(2)),
        message: "Network SSE connection error",
      });
    };

    source.addEventListener("network.connection.changed", onConnectionChanged);
    source.addEventListener("network.device.state.changed", onDeviceStateChanged);
    source.addEventListener("error", onError);

    return () => {
      source.removeEventListener("network.connection.changed", onConnectionChanged);
      source.removeEventListener("network.device.state.changed", onDeviceStateChanged);
      source.removeEventListener("error", onError);
      source.close();

      setStatus("disconnected");
      logClientAction({
        layer: "hook",
        action: "hooks.useNetworkEventsSse.connection",
        status: "info",
        durationMs: Number((performance.now() - connectedAt).toFixed(2)),
        message: "Network SSE connection closed",
      });
    };
  }, [enabled, queryClient]);

  return {
    status,
  };
}
