"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { StoreAppDetail } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";

type StoreAppDetailResponse = {
  data: StoreAppDetail;
};

const STORE_APP_REQUEST_TIMEOUT_MS = 10_000;

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
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, STORE_APP_REQUEST_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Failed to fetch store app (request timeout)");
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

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
