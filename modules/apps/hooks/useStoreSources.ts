"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  StoreCatalogSource,
  StoreCatalogSourceCreateRequest,
  StoreCatalogSourceUpdateRequest,
} from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";

type StoreSourcesResponse = {
  data: StoreCatalogSource[];
};

type StoreSourceResponse = {
  data: StoreCatalogSource;
};

async function fetchStoreSources() {
  const response = await fetch("/api/v1/store/sources", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch store sources (${response.status})`);
  }

  const json = (await response.json()) as StoreSourcesResponse;
  return json.data;
}

async function createStoreSource(payload: StoreCatalogSourceCreateRequest) {
  const response = await fetch("/api/v1/store/sources", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Failed to add store source (${response.status})`);
  }

  const json = (await response.json()) as StoreSourceResponse;
  return json.data;
}

async function updateStoreSource(input: {
  sourceId: string;
  payload: StoreCatalogSourceUpdateRequest;
}) {
  const response = await fetch(`/api/v1/store/sources/${encodeURIComponent(input.sourceId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.payload),
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Failed to update store source (${response.status})`);
  }

  const json = (await response.json()) as StoreSourceResponse;
  return json.data;
}

async function refreshStoreSource(sourceId: string) {
  const response = await fetch(
    `/api/v1/store/sources/${encodeURIComponent(sourceId)}/refresh`,
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Failed to refresh store source (${response.status})`);
  }

  const json = (await response.json()) as StoreSourceResponse;
  return json.data;
}

async function deleteStoreSource(sourceId: string) {
  const response = await fetch(`/api/v1/store/sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Failed to remove store source (${response.status})`);
  }

  const json = (await response.json()) as StoreSourceResponse;
  return json.data;
}

export function useStoreSources() {
  return useQuery({
    queryKey: queryKeys.storeSources,
    queryFn: fetchStoreSources,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useStoreSourceActions() {
  const queryClient = useQueryClient();

  function invalidateStoreState() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.storeSources });
    void queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog });
  }

  const addSource = useMutation({
    mutationFn: createStoreSource,
    onSuccess: invalidateStoreState,
  });

  const updateSource = useMutation({
    mutationFn: updateStoreSource,
    onSuccess: invalidateStoreState,
  });

  const refreshSource = useMutation({
    mutationFn: refreshStoreSource,
    onSuccess: invalidateStoreState,
  });

  const removeSource = useMutation({
    mutationFn: deleteStoreSource,
    onSuccess: invalidateStoreState,
  });

  return {
    addSource,
    updateSource,
    refreshSource,
    removeSource,
  };
}
