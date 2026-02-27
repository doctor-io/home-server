"use client";

import { withClientTiming } from "@/lib/client/logger";
import { queryKeys } from "@/lib/shared/query-keys";
import { useQuery } from "@tanstack/react-query";

type CurrentUser = {
  id: string;
  username: string;
};

type CurrentUserResponse = {
  data: CurrentUser;
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
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useCurrentUser.fetch",
      meta: {
        endpoint: "/api/auth/me",
      },
    },
    async () => {
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
    },
  );
}

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 60_000,
  });
}
