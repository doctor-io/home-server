"use client";

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchTelemetryEnabled(): Promise<boolean> {
  const res = await fetch("/api/v1/settings/telemetry");
  const data = await res.json() as { enabled: boolean };
  return data.enabled;
}

async function updateTelemetryEnabled(enabled: boolean): Promise<void> {
  await fetch("/api/v1/settings/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

export function useTelemetry() {
  const queryClient = useQueryClient();

  const { data: enabled = true, isLoading } = useQuery({
    queryKey: ["settings", "telemetry"],
    queryFn: fetchTelemetryEnabled,
  });

  const { mutate } = useMutation({
    mutationFn: updateTelemetryEnabled,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["settings", "telemetry"] });
      const previous = queryClient.getQueryData<boolean>(["settings", "telemetry"]);
      queryClient.setQueryData(["settings", "telemetry"], next);
      return { previous };
    },
    onError: (_err, _next, ctx) => {
      queryClient.setQueryData(["settings", "telemetry"], ctx?.previous);
    },
  });

  const toggle = useCallback(() => mutate(!enabled), [mutate, enabled]);

  return { enabled, isLoading, toggle };
}
