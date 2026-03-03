"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { InstalledApp } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";

type InstalledAppsResponse = {
  data: InstalledApp[];
};

const STATUS_VERIFY_POLL_INTERVAL_MS = 2_000;
const STATUS_VERIFY_WINDOW_MS = 30_000;

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
    refetchInterval: (query) => {
      const apps = query.state.data;
      if (!apps || apps.length === 0) {
        return false;
      }

      const now = Date.now();
      const shouldPollForVerification = apps.some((app) => {
        if (app.status === "running") {
          return false;
        }

        const updatedAtMs = Date.parse(app.updatedAt);
        if (!Number.isFinite(updatedAtMs)) {
          return false;
        }

        return now - updatedAtMs <= STATUS_VERIFY_WINDOW_MS;
      });

      return shouldPollForVerification ? STATUS_VERIFY_POLL_INTERVAL_MS : false;
    },
  });
}
