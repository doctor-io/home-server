"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/shared/query-keys";
import type { DockerInfo } from "@/lib/shared/contracts/docker";

async function fetchDockerInfo(): Promise<DockerInfo> {
  const response = await fetch("/api/v1/docker/info");

  if (!response.ok) {
    throw new Error(`Failed to fetch Docker info (${response.status})`);
  }

  const json = (await response.json()) as { data: DockerInfo };
  return json.data;
}

/**
 * Fetches Docker engine metadata (version, storage driver, cgroup driver, image count).
 * Returns `null` data (not an error) when the daemon is unreachable (503).
 */
export function useDockerInfo() {
  return useQuery({
    queryKey: queryKeys.dockerInfo,
    queryFn: fetchDockerInfo,
    staleTime: 60_000, // engine info rarely changes; refresh once per minute
    retry: false,
  });
}
