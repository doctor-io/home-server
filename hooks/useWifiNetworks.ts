"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { WifiAccessPoint } from "@/lib/shared/contracts/network";
import { queryKeys } from "@/lib/shared/query-keys";

type WifiNetworksResponse = {
  data: WifiAccessPoint[];
  meta?: {
    source?: "helper" | "fallback";
    count?: number;
  };
};

async function fetchWifiNetworks() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useWifiNetworks.fetch",
      meta: {
        endpoint: "/api/v1/network/networks",
      },
    },
    async () => {
      const response = await fetch("/api/v1/network/networks", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Wi-Fi networks (${response.status})`);
      }

      const json = (await response.json()) as WifiNetworksResponse;
      return json.data;
    },
  );
}

export function useWifiNetworks() {
  return useQuery({
    queryKey: queryKeys.networkNetworks,
    queryFn: fetchWifiNetworks,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}
