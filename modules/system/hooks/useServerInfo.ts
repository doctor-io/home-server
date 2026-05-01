"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/shared/query-keys";
import type { ServerHardwareInfo } from "@/lib/shared/contracts/server-info";

async function fetchServerInfo(): Promise<ServerHardwareInfo> {
  const res = await fetch("/api/v1/system/info");
  if (!res.ok) throw new Error("Failed to fetch server info");
  const json = (await res.json()) as { data: ServerHardwareInfo };
  return json.data;
}

export function useServerInfo() {
  return useQuery({
    queryKey: queryKeys.serverInfo,
    queryFn: fetchServerInfo,
    staleTime: 5 * 60 * 1_000,
    refetchOnWindowFocus: false,
  });
}
