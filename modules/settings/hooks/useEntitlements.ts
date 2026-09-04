"use client";

import {
  UNLICENSED_SNAPSHOT,
  type Entitlement,
  type EntitlementsSnapshot,
} from "@/lib/shared/contracts/licensing";
import { queryKeys } from "@/lib/shared/query-keys";
import { useQuery } from "@tanstack/react-query";

async function fetchEntitlements(): Promise<EntitlementsSnapshot> {
  // no-store, because a licence can lapse between two reads and a cached
  // "active" would keep the UI claiming a plan the server no longer honours.
  const response = await fetch("/api/v1/licensing/entitlements", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch entitlements (${response.status})`);
  }

  const json = (await response.json()) as { data: EntitlementsSnapshot };
  return json.data;
}

/**
 * What this server is licensed for.
 *
 * Only ever used to decide what to show. The server enforces entitlements on
 * its own; nothing here is a security boundary.
 */
export function useEntitlements() {
  const query = useQuery({
    queryKey: queryKeys.entitlements,
    queryFn: fetchEntitlements,
    staleTime: 5 * 60_000,
  });

  return {
    // A failed read falls back to the free plan: showing less than is owed is
    // recoverable with a refresh, showing more is not.
    snapshot: query.data ?? UNLICENSED_SNAPSHOT,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useHasEntitlement(entitlement: Entitlement): boolean {
  return useEntitlements().snapshot.entitlements.includes(entitlement);
}
