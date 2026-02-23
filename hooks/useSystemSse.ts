"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { logClientAction } from "@/lib/client/logger";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import { queryKeys } from "@/lib/shared/query-keys";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

function parseMetricsEvent(rawData: string): SystemMetricsSnapshot | null {
  try {
    return JSON.parse(rawData) as SystemMetricsSnapshot;
  } catch {
    return null;
  }
}

export function useSystemSse(enabled = true) {
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
      action: "hooks.useSystemSse.connection",
      status: "start",
      meta: {
        endpoint: "/api/v1/system/stream",
      },
    });

    const eventSource = new EventSource("/api/v1/system/stream");

    eventSource.onopen = () => {
      setStatus("connected");
      logClientAction({
        layer: "hook",
        action: "hooks.useSystemSse.connection",
        status: "success",
        durationMs: Number((performance.now() - connectedAt).toFixed(2)),
      });
    };

    const metricsListener = (event: MessageEvent) => {
      const parsed = parseMetricsEvent(event.data);
      if (!parsed) {
        logClientAction({
          level: "warn",
          layer: "hook",
          action: "hooks.useSystemSse.metrics.parse",
          status: "error",
          message: "Failed to parse metrics event",
        });
        return;
      }

      queryClient.setQueryData(queryKeys.systemMetrics, parsed);

      logClientAction({
        level: "debug",
        layer: "hook",
        action: "hooks.useSystemSse.metrics.update",
        status: "info",
      });
    };

    const errorListener = () => {
      setStatus("disconnected");
      logClientAction({
        level: "error",
        layer: "hook",
        action: "hooks.useSystemSse.connection",
        status: "error",
        durationMs: Number((performance.now() - connectedAt).toFixed(2)),
        message: "SSE connection error",
      });
    };

    eventSource.addEventListener("metrics.updated", metricsListener);
    eventSource.addEventListener("error", errorListener);

    return () => {
      eventSource.removeEventListener("metrics.updated", metricsListener);
      eventSource.removeEventListener("error", errorListener);
      eventSource.close();
      setStatus("disconnected");

      logClientAction({
        layer: "hook",
        action: "hooks.useSystemSse.connection",
        status: "info",
        durationMs: Number((performance.now() - connectedAt).toFixed(2)),
        message: "SSE connection closed",
      });
    };
  }, [enabled, queryClient]);

  return { status };
}
