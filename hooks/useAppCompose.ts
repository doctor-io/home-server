import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/shared/query-keys";

export type AppComposeData = {
  image?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  networkMode?: string;
  restart?: string;
  privileged?: boolean;
  capAdd?: string[];
  hostname?: string;
  devices?: string[];
  command?: string | string[];
};

export type AppComposeResponse = {
  compose: string;
  primary: AppComposeData;
  primaryServiceName: string;
};

/**
 * Fetch and parse the docker-compose.yml for an app from its GitHub repository.
 * Used to pre-fill the app settings dialog with default values.
 */
export function useAppCompose(
  appId: string | undefined,
  enabled = true,
  source: "catalog" | "installed" = "catalog",
) {
  return useQuery({
    queryKey: queryKeys.appCompose(appId ?? "", source),
    queryFn: async () => {
      if (!appId) throw new Error("App ID is required");

      const response = await fetch(
        `/api/v1/store/apps/${appId}/compose?source=${encodeURIComponent(source)}`,
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null) as
          | { error?: string; code?: string }
          | null;
        const message = payload?.error?.trim() || "Failed to fetch compose file";
        const code = payload?.code?.trim();
        throw new Error(code ? `${message} [${code}]` : message);
      }

      const json = await response.json();
      return json.data as AppComposeResponse;
    },
    enabled: enabled && !!appId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
