"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { StoreAppDetail } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";

type StoreAppDetailResponse = {
  data: StoreAppDetail;
};

export async function fetchStoreApp(appId: string) {
  const endpoint = `/api/v1/store/apps/${encodeURIComponent(appId)}`;

  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useStoreApp.fetch",
      meta: {
        endpoint,
        appId,
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch store app (${response.status})`);
      }

      const json = (await response.json()) as StoreAppDetailResponse;
      return json.data;
    },
  );
}

export function useStoreApp(appId: string | null) {
  return useQuery({
    queryKey: appId ? queryKeys.storeApp(appId) : ["store", "app", "none"],
    queryFn: () => fetchStoreApp(appId as string),
    enabled: Boolean(appId),
    staleTime: 10_000,
  });
}
