import { describe, expect, it, vi } from "vitest";

const ingestClientLogMock = vi.fn();
const logServerActionMock = vi.fn();

vi.mock("@/lib/server/logging/logger", () => ({
  createRequestId: () => "req-1",
  ingestClientLog: (...args: unknown[]) => ingestClientLogMock(...args),
  logServerAction: (...args: unknown[]) => logServerActionMock(...args),
}));

import { POST } from "@/app/api/v1/logs/route";

describe("POST /api/v1/logs", () => {
  it("ingests client log payload and returns 204", async () => {
    const request = new Request("http://localhost/api/v1/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timestamp: "2026-02-23T22:10:00.000Z",
        runtime: "client",
        level: "info",
        layer: "hook",
        action: "hooks.test.action",
        status: "success",
        meta: {
          endpoint: "/api/v1/store/apps",
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(ingestClientLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: "client",
        layer: "hook",
        action: "hooks.test.action",
      }),
    );
  });

  it("returns 400 when payload is invalid", async () => {
    const request = new Request("http://localhost/api/v1/logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        level: "info",
      }),
    });

    const response = await POST(request);
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid client log payload");
    expect(ingestClientLogMock).not.toHaveBeenCalled();
  });
});
