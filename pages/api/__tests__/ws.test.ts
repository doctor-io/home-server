import { describe, expect, it, vi } from "vitest";

const wssOn = vi.fn();
const wssHandleUpgrade = vi.fn();

vi.mock("ws", () => {
  const WebSocketServer = vi.fn(
    class MockWebSocketServer {
      on = wssOn;
      emit = vi.fn();
      handleUpgrade = wssHandleUpgrade;
    },
  );

  return { WebSocketServer };
});

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    WEBSOCKET_ENABLED: true,
    METRICS_PUBLISH_INTERVAL_MS: 5000,
    LOG_LEVEL: "info",
    LOG_FILE_PATH: "logs/home-server.log",
    LOG_TO_FILE: true,
  },
}));

vi.mock("@/lib/server/modules/system/service", () => ({
  getSystemMetricsSnapshot: vi.fn(async () => ({
    timestamp: "2026-02-22T12:00:00.000Z",
  })),
}));

import handler from "@/pages/api/ws";

describe("GET /api/ws", () => {
  it("returns 500 when socket server is unavailable", async () => {
    const res = {
      socket: null,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Parameters<typeof handler>[1];

    await handler({} as Parameters<typeof handler>[0], res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false }),
    );
  });

  it("initializes websocket wiring and returns endpoint metadata", async () => {
    const server = {
      on: vi.fn(),
      homeioWssInitialized: false,
    };

    const res = {
      socket: { server },
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Parameters<typeof handler>[1];

    await handler({} as Parameters<typeof handler>[0], res);

    expect(server.on).toHaveBeenCalledWith("upgrade", expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        path: "/api/ws",
      }),
    );
  });
});
