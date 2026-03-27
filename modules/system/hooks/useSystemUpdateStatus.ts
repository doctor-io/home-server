"use client";

import { useQuery } from "@tanstack/react-query";
import type { SystemUpdateStatus } from "@/lib/shared/contracts/system";
import { queryKeys } from "@/lib/shared/query-keys";

async function fetchSystemUpdateStatusRequest(): Promise<SystemUpdateStatus> {
  const response = await fetch("/api/v1/system/updates", {
    cache: "no-store",
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Failed to load Homeio updates (${response.status})`);
  }

  const json = (await response.json()) as { data: SystemUpdateStatus };
  return json.data;
}

export function useSystemUpdateStatus() {
  return useQuery({
    queryKey: queryKeys.systemUpdates,
    queryFn: fetchSystemUpdateStatusRequest,
    staleTime: 60_000,
  });
}
