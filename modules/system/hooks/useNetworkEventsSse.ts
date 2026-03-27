"use client";

import {
  POWER_ACTION_STATE_CHANGED_EVENT,
  readPersistedPowerActionState,
} from "@/lib/desktop/reboot-state";
import { queryKeys } from "@/lib/shared/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

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

function networkEventSignature(
  type: string,
  payload: ParsedNetworkEvent | null,
) {
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
    };

    source.addEventListener("network.connection.changed", onConnectionChanged);
    source.addEventListener(
      "network.device.state.changed",
      onDeviceStateChanged,
    );
    source.addEventListener("error", onError);

    return () => {
      if (refreshTimeout !== null) {
        clearTimeout(refreshTimeout);
      }
      source.removeEventListener(
        "network.connection.changed",
        onConnectionChanged,
      );
      source.removeEventListener(
        "network.device.state.changed",
        onDeviceStateChanged,
      );
      source.removeEventListener("error", onError);
      source.close();

      setStatus("disconnected");
    };
  }, [enabled, isPowerActionActive, queryClient]);

  return {
    status,
  };
}
