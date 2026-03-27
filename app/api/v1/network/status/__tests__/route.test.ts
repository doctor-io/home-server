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
  getNetworkStatus: vi.fn(),
}));

import { GET } from "@/app/api/v1/network/status/route";
import {
  NetworkServiceError,
  getNetworkStatus,
} from "@/lib/server/modules/network/service";

describe("GET /api/v1/network/status", () => {
  it("returns network status data", async () => {
    vi.mocked(getNetworkStatus).mockResolvedValueOnce({
      data: {
        connected: true,
        iface: "wlan0",
        ssid: "HomeNet",
        ipv4: "192.168.1.12",
        signalPercent: 66,
      },
      source: "helper",
    });

    const response = await GET();
    const json = (await response.json()) as {
      data: { connected: boolean };
      meta: { source: string };
    };

    expect(response.status).toBe(200);
    expect(json.data.connected).toBe(true);
    expect(json.meta.source).toBe("helper");
  });

  it("returns mapped service errors", async () => {
    vi.mocked(getNetworkStatus).mockRejectedValueOnce(
      new NetworkServiceError("helper unavailable", "helper_unavailable", 503),
    );

    const response = await GET();
    const json = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(json.code).toBe("helper_unavailable");
  });
});
