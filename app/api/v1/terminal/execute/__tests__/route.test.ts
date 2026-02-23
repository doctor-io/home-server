import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/terminal/service", () => ({
  executeTerminalCommand: vi.fn(),
  TerminalServiceError: class TerminalServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(
      message: string,
      options?: { code?: string; statusCode?: number },
    ) {
      super(message);
      this.code = options?.code ?? "execution_failed";
      this.statusCode = options?.statusCode ?? 500;
    }
  },
}));

import { POST } from "@/app/api/v1/terminal/execute/route";
import {
  executeTerminalCommand,
  TerminalServiceError,
} from "@/lib/server/modules/terminal/service";

describe("POST /api/v1/terminal/execute", () => {
  it("returns terminal execution result", async () => {
    vi.mocked(executeTerminalCommand).mockResolvedValueOnce({
      cwd: "/home/homeio",
      lines: [
        {
          type: "output",
          content: "hello",
        },
      ],
      exitCode: 0,
      durationMs: 5,
    });

    const request = new Request("http://localhost/api/v1/terminal/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: "echo hello",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as {
      data: { cwd: string };
    };

    expect(response.status).toBe(200);
    expect(json.data.cwd).toBe("/home/homeio");
  });

  it("maps typed service errors", async () => {
    vi.mocked(executeTerminalCommand).mockRejectedValueOnce(
      new TerminalServiceError("forbidden", {
        code: "forbidden_command",
        statusCode: 403,
      }),
    );

    const request = new Request("http://localhost/api/v1/terminal/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: "rm -rf /",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(403);
    expect(json.code).toBe("forbidden_command");
  });
});
