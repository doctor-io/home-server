"use client";

import { useQuery } from "@tanstack/react-query";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import { queryKeys } from "@/lib/shared/query-keys";

type MetricsResponse = {
  data: SystemMetricsSnapshot;
};

async function fetchSystemMetrics(): Promise<SystemMetricsSnapshot> {
  const response = await fetch("/api/v1/system/metrics", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch system metrics (${response.status})`);
  }

  const json = (await response.json()) as MetricsResponse;
  return json.data;
}

export function useSystemMetrics() {
  return useQuery({
    queryKey: queryKeys.systemMetrics,
    queryFn: fetchSystemMetrics,
    // useSystemSse drives continuous cache updates via queryClient.setQueryData.
    // Set staleTime to Infinity so React Query does not refetch on its own —
    // one initial REST fetch gives us a baseline while SSE warms up.
    staleTime: Infinity,
  });
}
