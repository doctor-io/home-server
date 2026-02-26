"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type {
  CreateNetworkShareRequest,
  DiscoverServersResponse,
  DiscoverSharesRequest,
  DiscoverSharesResponse,
  NetworkShareStatus,
} from "@/lib/shared/contracts/files";
import { queryKeys } from "@/lib/shared/query-keys";

type NetworkSharesResponse = {
  data: NetworkShareStatus[];
  meta?: {
    count: number;
  };
};

type NetworkShareResponse = {
  data: NetworkShareStatus;
};

type DiscoverServersApiResponse = {
  data: DiscoverServersResponse;
};

type DiscoverSharesApiResponse = {
  data: DiscoverSharesResponse;
};

function mapError(responseStatus: number, errorBody: { error?: string; code?: string }) {
  return (
    errorBody.error ??
    `Request failed (${responseStatus})${errorBody.code ? ` [${errorBody.code}]` : ""}`
  );
}

async function listShares() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkShares.list",
    },
    async () => {
      const response = await fetch("/api/v1/files/network/shares", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as NetworkSharesResponse;
      return json.data;
    },
  );
}

async function createShare(payload: CreateNetworkShareRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkShares.create",
    },
    async () => {
      const response = await fetch("/api/v1/files/network/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as NetworkShareResponse;
      return json.data;
    },
  );
}

async function deleteShare(shareId: string) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkShares.remove",
      meta: {
        shareId,
      },
    },
    async () => {
      const response = await fetch(`/api/v1/files/network/shares/${encodeURIComponent(shareId)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      return true;
    },
  );
}

async function mountShare(shareId: string) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkShares.mount",
      meta: {
        shareId,
      },
    },
    async () => {
      const response = await fetch(
        `/api/v1/files/network/shares/${encodeURIComponent(shareId)}/mount`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as NetworkShareResponse;
      return json.data;
    },
  );
}

async function unmountShare(shareId: string) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkShares.unmount",
      meta: {
        shareId,
      },
    },
    async () => {
      const response = await fetch(
        `/api/v1/files/network/shares/${encodeURIComponent(shareId)}/unmount`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as NetworkShareResponse;
      return json.data;
    },
  );
}

async function discoverServers() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkShares.discoverServers",
    },
    async () => {
      const response = await fetch("/api/v1/files/network/discover/servers", {
        cache: "no-store",
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as DiscoverServersApiResponse;
      return json.data;
    },
  );
}

async function discoverHostShares(payload: DiscoverSharesRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useNetworkShares.discoverShares",
      meta: {
        host: payload.host,
      },
    },
    async () => {
      const response = await fetch("/api/v1/files/network/discover/shares", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        throw new Error(mapError(response.status, errorBody));
      }

      const json = (await response.json()) as DiscoverSharesApiResponse;
      return json.data;
    },
  );
}

function invalidateNetworkQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({
    queryKey: queryKeys.networkShares,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.filesList("Network"),
  });
}

export function useNetworkShares() {
  return useQuery({
    queryKey: queryKeys.networkShares,
    queryFn: listShares,
    staleTime: 5_000,
  });
}

export function useCreateNetworkShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createShare,
    onSuccess: () => {
      invalidateNetworkQueries(queryClient);
    },
  });
}

export function useRemoveNetworkShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteShare,
    onSuccess: () => {
      invalidateNetworkQueries(queryClient);
    },
  });
}

export function useMountNetworkShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mountShare,
    onSuccess: () => {
      invalidateNetworkQueries(queryClient);
    },
  });
}

export function useUnmountNetworkShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unmountShare,
    onSuccess: () => {
      invalidateNetworkQueries(queryClient);
    },
  });
}

export function useDiscoverNetworkServers() {
  return useMutation({
    mutationFn: discoverServers,
  });
}

export function useDiscoverNetworkShares() {
  return useMutation({
    mutationFn: discoverHostShares,
  });
}
