"use client";

import { useCallback, useState } from "react";
import type {
  TerminalExecuteRequest,
  TerminalExecuteResult,
} from "@/lib/shared/contracts/terminal";

async function postTerminalCommand(
  payload: TerminalExecuteRequest,
  signal?: AbortSignal,
): Promise<TerminalExecuteResult> {
  const response = await fetch("/api/v1/terminal/execute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
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

  const json = (await response.json()) as { data: TerminalExecuteResult };
  return json.data;
}

export function useTerminalCommand() {
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<Error | null>(null);

  const executeCommand = useCallback(
    async (payload: TerminalExecuteRequest, signal?: AbortSignal) => {
      setIsExecuting(true);
      setExecuteError(null);
      try {
        const result = await postTerminalCommand(payload, signal);
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Unknown error");
        if (err.name !== "AbortError") {
          setExecuteError(err);
        }
        throw error;
      } finally {
        setIsExecuting(false);
      }
    },
    [],
  );

  return { executeCommand, isExecuting, executeError };
}
