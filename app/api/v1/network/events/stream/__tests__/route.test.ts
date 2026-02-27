import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    SSE_HEARTBEAT_MS: 60_000,
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

describe("GET /api/v1/network/events/stream", () => {
  it("streams network events as SSE", async () => {
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
