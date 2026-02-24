"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type { NetworkStatus } from "@/lib/shared/contracts/network";
import { queryKeys } from "@/lib/shared/query-keys";

type NetworkMutationResponse = {
  data: NetworkStatus;
};

type ErrorResponsePayload = {
  error?: string;
  code?: string;
};

function toNetworkActionErrorMessage(
  endpoint: string,
  status: number,
  payload: ErrorResponsePayload | null,
) {
  const baseMessage = payload?.error?.trim() || `Network action failed (${status}) for ${endpoint}`;
  const code = payload?.code?.trim();
  if (!code) return baseMessage;

  if (code === "helper_unavailable") {
    return "DBus helper unavailable. Check home-server-dbus service status.";
  }

  if (code === "network_manager_unavailable") {
    return "NetworkManager is unavailable on this server.";
  }

  if (code === "auth_failed") {
    return "Wi-Fi authentication failed. Check the network password.";
  }

  return `${baseMessage} [${code}]`;
}

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as ErrorResponsePayload;
  } catch {
    return null;
  }
}

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
        const errorPayload = await parseErrorPayload(response);
        throw new Error(
          toNetworkActionErrorMessage(endpoint, response.status, errorPayload),
        );
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
