"use client";

import type { CurrentUserData } from "@/lib/shared/contracts/auth";
import { queryKeys } from "@/lib/shared/query-keys";
import { useQuery } from "@tanstack/react-query";

type CurrentUserResponse = {
  data: CurrentUserData;
};

export class CurrentUserError extends Error {
  readonly status: number;
  readonly redirectTo?: string;

  constructor(message: string, status: number, redirectTo?: string) {
    super(message);
    this.name = "CurrentUserError";
    this.status = status;
    this.redirectTo = redirectTo;
  }
}

async function fetchCurrentUser() {
  const response = await fetch("/api/auth/me", {
    cache: "no-store",
  });

  if (!response.ok) {
    const redirectTo = response.headers.get("x-auth-entry") ?? undefined;
    throw new CurrentUserError(
      `Failed to fetch current user (${response.status})`,
      response.status,
      redirectTo,
    );
  }

  const json = (await response.json()) as CurrentUserResponse;
  return json.data;
}

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
}
