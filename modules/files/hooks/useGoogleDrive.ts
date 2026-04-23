"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/shared/query-keys";

export type GoogleDriveConnection = {
  id: string;
  email: string;
  displayName: string | null;
  connectedAt: string;
};

type ConnectionsApiResponse = { data: GoogleDriveConnection[] };

function mapError(status: number, body: { error?: string; code?: string }) {
  return body.error ?? `Request failed (${status})${body.code ? ` [${body.code}]` : ""}`;
}

async function listConnections(): Promise<GoogleDriveConnection[]> {
  const res = await fetch("/api/v1/files/google-drive/connections", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new Error(mapError(res.status, body));
  }
  const json = (await res.json()) as ConnectionsApiResponse;
  return json.data;
}

async function removeConnection(id: string): Promise<void> {
  const res = await fetch(`/api/v1/files/google-drive/connections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new Error(mapError(res.status, body));
  }
}

export function useGoogleDriveConnections() {
  return useQuery({
    queryKey: queryKeys.googleDriveConnections,
    queryFn: listConnections,
    staleTime: 5_000,
  });
}

export function useRemoveGoogleDriveConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeConnection,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.googleDriveConnections });
    },
  });
}
