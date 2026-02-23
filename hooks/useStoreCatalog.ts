"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { StoreAppSummary } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";

type StoreCatalogResponse = {
  data: StoreAppSummary[];
  meta: {
    count: number;
  };
};

type UseStoreCatalogOptions = {
  category?: string;
  search?: string;
  installedOnly?: boolean;
  updatesOnly?: boolean;
};

function buildCatalogUrl(options?: UseStoreCatalogOptions) {
  const params = new URLSearchParams();

  if (options?.category) params.set("category", options.category);
  if (options?.search) params.set("search", options.search);
  if (options?.installedOnly) params.set("installedOnly", "true");
  if (options?.updatesOnly) params.set("updatesOnly", "true");

  const query = params.toString();
  return query.length > 0 ? `/api/v1/store/apps?${query}` : "/api/v1/store/apps";
}

async function fetchStoreCatalog(options?: UseStoreCatalogOptions) {
  const endpoint = buildCatalogUrl(options);

  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useStoreCatalog.fetch",
      meta: {
        endpoint,
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch store catalog (${response.status})`);
      }

      const json = (await response.json()) as StoreCatalogResponse;
      return json.data;
    },
  );
}

export function useStoreCatalog(options?: UseStoreCatalogOptions) {
  return useQuery({
    queryKey: [...queryKeys.storeCatalog, options ?? {}] as const,
    queryFn: () => fetchStoreCatalog(options),
    staleTime: 10_000,
  });
}
