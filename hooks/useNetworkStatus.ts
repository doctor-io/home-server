"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { NetworkStatus } from "@/lib/shared/contracts/network";
import { queryKeys } from "@/lib/shared/query-keys";

type NetworkStatusResponse = {
  data: NetworkStatus;
  meta?: {
    source?: "helper" | "fallback";
  };
};

async function fetchNetworkStatus() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkStatus.fetch",
      meta: {
        endpoint: "/api/v1/network/status",
      },
    },
    async () => {
      const response = await fetch("/api/v1/network/status", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch network status (${response.status})`);
      }

      const json = (await response.json()) as NetworkStatusResponse;
      return json.data;
    },
  );
}

export function useNetworkStatus() {
  return useQuery({
    queryKey: queryKeys.networkStatus,
    queryFn: fetchNetworkStatus,
    refetchInterval: (query) => {
      if (query.state.status !== "error") {
        // SSE-driven invalidation keeps this fresh; polling is fallback only.
        return 120_000;
      }

      const failureCount = Math.max(1, query.state.fetchFailureCount);
      const exponentialBackoffMs = 60_000 * 2 ** Math.min(failureCount - 1, 2);
      return Math.min(exponentialBackoffMs, 300_000);
    },
    staleTime: 10_000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
}
