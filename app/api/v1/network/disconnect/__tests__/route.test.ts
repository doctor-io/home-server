import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/network/service", () => ({
  NetworkServiceError: class NetworkServiceError extends Error {
    code: string;
    statusCode: number;

    constructor(message: string, code = "internal_error", statusCode = 500) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
  disconnectNetwork: vi.fn(),
}));

import { POST } from "@/app/api/v1/network/disconnect/route";
import { disconnectNetwork } from "@/lib/server/modules/network/service";

describe("POST /api/v1/network/disconnect", () => {
  it("starts network disconnect flow", async () => {
    vi.mocked(disconnectNetwork).mockResolvedValueOnce({
      connected: false,
      iface: "wlan0",
      ssid: null,
      ipv4: null,
      signalPercent: null,
    });

    const response = await POST(
      new Request("http://localhost/api/v1/network/disconnect", {
        method: "POST",
        body: JSON.stringify({
          iface: "wlan0",
        }),
      }),
    );

    expect(response.status).toBe(202);
  });
});
