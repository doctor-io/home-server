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
  connectNetwork: vi.fn(),
}));

import { POST } from "@/app/api/v1/network/connect/route";
import {
  NetworkServiceError,
  connectNetwork,
} from "@/lib/server/modules/network/service";

describe("POST /api/v1/network/connect", () => {
  it("starts network connect flow", async () => {
    vi.mocked(connectNetwork).mockResolvedValueOnce({
      connected: true,
      iface: "wlan0",
      ssid: "HomeNet",
      ipv4: "192.168.1.12",
      signalPercent: 65,
    });

    const response = await POST(
      new Request("http://localhost/api/v1/network/connect", {
        method: "POST",
        body: JSON.stringify({
          ssid: "HomeNet",
          password: "secret",
        }),
      }),
    );

    expect(response.status).toBe(202);
  });

  it("returns mapped service errors", async () => {
    vi.mocked(connectNetwork).mockRejectedValueOnce(
      new NetworkServiceError("invalid", "invalid_request", 400),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/network/connect", {
        method: "POST",
        body: JSON.stringify({
          ssid: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
