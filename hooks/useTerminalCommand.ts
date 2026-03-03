"use client";

import { useMutation } from "@tanstack/react-query";
import { withClientTiming } from "@/lib/client/logger";
import type {
  TerminalExecuteRequest,
  TerminalExecuteResult,
} from "@/lib/shared/contracts/terminal";

type TerminalMutationResponse = {
  data: TerminalExecuteResult;
};

async function postTerminalCommand(payload: TerminalExecuteRequest) {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useTerminalCommand.execute",
      meta: {
        endpoint: "/api/v1/terminal/execute",
        command: payload.command.split(/\s+/)[0] ?? "",
      },
    },
    async () => {
      const response = await fetch("/api/v1/terminal/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          body.error ??
            `Failed to execute terminal command (${response.status})`,
        );
      }

      const json = (await response.json()) as TerminalMutationResponse;
      return json.data;
    },
  );
}

export function useTerminalCommand() {
  const mutation = useMutation({
    mutationFn: postTerminalCommand,
  });

  return {
    executeCommand: mutation.mutateAsync,
    isExecuting: mutation.isPending,
    executeError: mutation.error,
  };
}
