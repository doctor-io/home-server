"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { InstalledApp } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";

type InstalledAppsResponse = {
  data: InstalledApp[];
};

async function fetchInstalledApps() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useInstalledApps.fetch",
      meta: {
        endpoint: "/api/v1/apps",
      },
    },
    async () => {
      const response = await fetch("/api/v1/apps", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch apps (${response.status})`);
      }

      const json = (await response.json()) as InstalledAppsResponse;
      return json.data;
    },
  );
}

export function useInstalledApps() {
  return useQuery({
    queryKey: queryKeys.installedApps,
    queryFn: fetchInstalledApps,
    staleTime: 10_000,
  });
}
