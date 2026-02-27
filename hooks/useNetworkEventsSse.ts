"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { logClientAction } from "@/lib/client/logger";
import { queryKeys } from "@/lib/shared/query-keys";

type ConnectionStatus = "connecting" | "connected" | "disconnected";
type ParsedNetworkEvent = {
  connected: boolean | null;
  iface: string | null;
  ssid: string | null;
  state: string | null;
  reason: string | null;
};

const INVALIDATION_DEBOUNCE_MS = 600;
const INVALIDATION_COOLDOWN_MS = 4_000;
const ERROR_LOG_COOLDOWN_MS = 30_000;

function parseNetworkEventPayload(data: string): ParsedNetworkEvent | null {
  try {
    const parsed = JSON.parse(data) as Partial<{
      connected: unknown;
      iface: unknown;
      ssid: unknown;
      state: unknown;
      reason: unknown;
    }>;

    return {
      connected:
        typeof parsed.connected === "boolean" ? parsed.connected : null,
      iface: typeof parsed.iface === "string" ? parsed.iface : null,
      ssid: typeof parsed.ssid === "string" ? parsed.ssid : null,
      state: typeof parsed.state === "string" ? parsed.state : null,
      reason: typeof parsed.reason === "string" ? parsed.reason : null,
    };
  } catch {
    return null;
  }
}

function networkEventSignature(type: string, payload: ParsedNetworkEvent | null) {
  if (!payload) {
    return `${type}:unknown`;
  }

  return [
    type,
    payload.connected === null ? "?" : String(payload.connected),
    payload.iface ?? "",
    payload.ssid ?? "",
    payload.state ?? "",
    payload.reason ?? "",
  ].join("|");
}

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
    let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
    let refreshQueued = false;
    let queuedNeedsNetworks = false;
    let lastInvalidateAt = 0;
    let lastConnectionSignature = "";
    let lastDeviceSignature = "";
    let lastErrorLogAt = 0;

    source.onopen = () => {
      setStatus("connected");
      logClientAction({
        layer: "hook",
        action: "hooks.useNetworkEventsSse.connection",
        status: "success",
        durationMs: Number((performance.now() - connectedAt).toFixed(2)),
      });
    };

    const refreshCachedQueries = (needsNetworks: boolean) => {
      const invalidations = [
        queryClient.invalidateQueries({
          queryKey: queryKeys.networkStatus,
        }),
      ];
      if (needsNetworks) {
        invalidations.push(
          queryClient.invalidateQueries({
            queryKey: queryKeys.networkNetworks,
          }),
        );
      }
      void Promise.all(invalidations);
    };

    const flushRefresh = () => {
      const now = Date.now();
      const elapsedMs = now - lastInvalidateAt;
      if (elapsedMs < INVALIDATION_COOLDOWN_MS) {
        const waitMs = INVALIDATION_COOLDOWN_MS - elapsedMs;
        refreshTimeout = setTimeout(flushRefresh, waitMs);
        return;
      }

      const needsNetworks = queuedNeedsNetworks;
      queuedNeedsNetworks = false;
      refreshQueued = false;
      refreshTimeout = null;
      lastInvalidateAt = now;
      refreshCachedQueries(needsNetworks);
    };

    const scheduleRefresh = (needsNetworks: boolean) => {
      queuedNeedsNetworks = queuedNeedsNetworks || needsNetworks;
      if (refreshQueued) return;
      refreshQueued = true;
      refreshTimeout = setTimeout(flushRefresh, INVALIDATION_DEBOUNCE_MS);
    };

    const onConnectionChanged = (event: MessageEvent) => {
      const payload = parseNetworkEventPayload(event.data);
      const signature = networkEventSignature(
        "network.connection.changed",
        payload,
      );
      if (signature === lastConnectionSignature) return;
      lastConnectionSignature = signature;
      scheduleRefresh(true);
    };

    const onDeviceStateChanged = (event: MessageEvent) => {
      const payload = parseNetworkEventPayload(event.data);
      const signature = networkEventSignature(
        "network.device.state.changed",
        payload,
      );
      if (signature === lastDeviceSignature) return;
      lastDeviceSignature = signature;
      scheduleRefresh(true);
    };

    const onError = () => {
      setStatus("disconnected");
      const now = Date.now();
      if (now - lastErrorLogAt < ERROR_LOG_COOLDOWN_MS) {
        return;
      }
      lastErrorLogAt = now;
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
      if (refreshTimeout !== null) {
        clearTimeout(refreshTimeout);
      }
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
