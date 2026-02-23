/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useTerminalCommand } from "@/hooks/useTerminalCommand";
import {
  createTestQueryClient,
  createWrapper,
} from "@/test/query-client-wrapper";

describe("useTerminalCommand", () => {
  it("executes terminal command endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          cwd: "/home/homeio",
          lines: [{ type: "output", content: "hello" }],
          exitCode: 0,
          durationMs: 4,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useTerminalCommand(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      const output = await result.current.executeCommand({
        command: "echo hello",
        cwd: "/home/homeio",
      });
      expect(output.cwd).toBe("/home/homeio");
      expect(output.lines).toHaveLength(1);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/terminal/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: "echo hello",
        cwd: "/home/homeio",
      }),
    });
  });
});
