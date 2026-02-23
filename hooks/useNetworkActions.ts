"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { NetworkStatus } from "@/lib/shared/contracts/network";
import { queryKeys } from "@/lib/shared/query-keys";

type NetworkMutationResponse = {
  data: NetworkStatus;
};

async function postNetworkAction(
  endpoint: string,
  payload: Record<string, unknown>,
  action: string,
) {
  return withClientTiming(
    {
      layer: "hook",
      action,
      meta: {
        endpoint,
      },
    },
    async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Network action failed (${response.status}) for ${endpoint}`);
      }

      const json = (await response.json()) as NetworkMutationResponse;
      return json.data;
    },
  );
}

export function useNetworkActions() {
  const queryClient = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: (input: { ssid: string; password?: string }) =>
      postNetworkAction(
        "/api/v1/network/connect",
        {
          ssid: input.ssid,
          password: input.password,
        },
        "hooks.useNetworkActions.connect",
      ),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.networkStatus }),
        queryClient.invalidateQueries({ queryKey: queryKeys.networkNetworks }),
      ]);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: (input?: { iface?: string }) =>
      postNetworkAction(
        "/api/v1/network/disconnect",
        input ?? {},
        "hooks.useNetworkActions.disconnect",
      ),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.networkStatus }),
        queryClient.invalidateQueries({ queryKey: queryKeys.networkNetworks }),
      ]);
    },
  });

  return {
    connectNetwork: connectMutation.mutateAsync,
    disconnectNetwork: disconnectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    actionError: connectMutation.error ?? disconnectMutation.error ?? null,
  };
}
