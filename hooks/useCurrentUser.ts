"use client";

import { useQuery } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import { queryKeys } from "@/lib/shared/query-keys";

type CurrentUser = {
  id: string;
  username: string;
};

type CurrentUserResponse = {
  data: CurrentUser;
};

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
        throw new Error(`Failed to fetch current user (${response.status})`);
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
