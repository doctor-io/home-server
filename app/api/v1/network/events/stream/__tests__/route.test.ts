import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    SSE_HEARTBEAT_MS: 60_000,
  },
}));

vi.mock("@/lib/server/modules/network/helper-client", () => ({
  getNetworkStatusFromHelper: vi.fn(),
  isNetworkHelperUnavailableError: vi.fn(() => false),
  NetworkHelperError: class NetworkHelperError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code = "internal_error", statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

vi.mock("@/lib/server/modules/network/events", () => ({
  getLatestNetworkEvent: vi.fn(),
  subscribeToNetworkEvents: vi.fn(),
}));

import { GET } from "@/app/api/v1/network/events/stream/route";
import {
  getLatestNetworkEvent,
  subscribeToNetworkEvents,
} from "@/lib/server/modules/network/events";
import { getNetworkStatusFromHelper } from "@/lib/server/modules/network/helper-client";

describe("GET /api/v1/network/events/stream", () => {
  it("streams network events as SSE", async () => {
    vi.mocked(getNetworkStatusFromHelper).mockResolvedValueOnce({
      connected: true,
      iface: "wlan0",
      ssid: "HomeNet",
      ipv4: "192.168.1.12",
      signalPercent: 65,
    });
    vi.mocked(getLatestNetworkEvent).mockReturnValueOnce({
      type: "network.connection.changed",
      timestamp: "2026-02-23T00:00:01.000Z",
      iface: "wlan0",
      ssid: "HomeNet",
      connected: true,
    });
    vi.mocked(subscribeToNetworkEvents).mockImplementation(() => () => undefined);

    const response = await GET(new Request("http://localhost"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const reader = response.body?.getReader();
    const chunk = await reader?.read();
    const text = new TextDecoder().decode(chunk?.value ?? new Uint8Array());

    expect(text).toContain("event: network.connection.changed");
    await reader?.cancel();
  });
});
