"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import { queryKeys } from "@/lib/shared/query-keys";

type MetricsResponse = {
  data: SystemMetricsSnapshot;
};

async function fetchSystemMetrics(): Promise<SystemMetricsSnapshot> {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useSystemMetrics.fetch",
      meta: {
        endpoint: "/api/v1/system/metrics",
      },
    },
    async () => {
      const response = await fetch("/api/v1/system/metrics", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch system metrics (${response.status})`);
      }

      const json = (await response.json()) as MetricsResponse;
      return json.data;
    },
  );
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: queryKeys.systemMetrics,
    queryFn: fetchSystemMetrics,
    refetchInterval: 15_000,
  });
}
