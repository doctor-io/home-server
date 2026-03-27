"use client";

import {
  POWER_ACTION_STATE_CHANGED_EVENT,
  readPersistedPowerActionState,
} from "@/lib/desktop/reboot-state";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import { queryKeys } from "@/lib/shared/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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
  const initialPowerActionActive =
    typeof window !== "undefined" &&
    readPersistedPowerActionState(window.localStorage) !== null;
  const [isPowerActionActive, setIsPowerActionActive] = useState(
    initialPowerActionActive,
  );
  const [status, setStatus] = useState<ConnectionStatus>(
    enabled && !initialPowerActionActive ? "connecting" : "disconnected",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncPowerActionState = () => {
      setIsPowerActionActive(
        readPersistedPowerActionState(window.localStorage) !== null,
      );
    };

    syncPowerActionState();

    window.addEventListener("storage", syncPowerActionState);
    window.addEventListener(
      POWER_ACTION_STATE_CHANGED_EVENT,
      syncPowerActionState,
    );

    return () => {
      window.removeEventListener("storage", syncPowerActionState);
      window.removeEventListener(
        POWER_ACTION_STATE_CHANGED_EVENT,
        syncPowerActionState,
      );
    };
  }, []);

  useEffect(() => {
    if (!enabled || isPowerActionActive) {
      setStatus("disconnected");
      return;
    }

    const eventSource = new EventSource("/api/v1/system/stream");

    eventSource.onopen = () => {
      setStatus("connected");
    };

    const metricsListener = (event: MessageEvent) => {
      const parsed = parseMetricsEvent(event.data);
      if (!parsed) {
        return;
      }

      queryClient.setQueryData(queryKeys.systemMetrics, parsed);
    };

    const errorListener = () => {
      setStatus("disconnected");
    };

    eventSource.addEventListener("metrics.updated", metricsListener);
    eventSource.addEventListener("error", errorListener);

    return () => {
      eventSource.removeEventListener("metrics.updated", metricsListener);
      eventSource.removeEventListener("error", errorListener);
      eventSource.close();
      setStatus("disconnected");
    };
  }, [enabled, isPowerActionActive, queryClient]);

  return { status };
}
