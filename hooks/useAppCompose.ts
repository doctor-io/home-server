import { useQuery } from "@tanstack/react-query";

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

/**
 * Fetch and parse the docker-compose.yml for an app from its GitHub repository.
 * Used to pre-fill the app settings dialog with default values.
 */
export function useAppCompose(appId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["app-compose", appId],
    queryFn: async () => {
      if (!appId) throw new Error("App ID is required");

      const response = await fetch(`/api/v1/store/apps/${appId}/compose`);

      if (!response.ok) {
        throw new Error("Failed to fetch compose file");
      }

      const json = await response.json();
      return json.data as AppComposeData;
    },
    enabled: enabled && !!appId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
