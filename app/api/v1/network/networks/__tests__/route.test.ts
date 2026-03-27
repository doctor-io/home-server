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
  getWifiNetworks: vi.fn(),
}));

import { GET } from "@/app/api/v1/network/networks/route";
import { getWifiNetworks } from "@/lib/server/modules/network/service";

describe("GET /api/v1/network/networks", () => {
  it("returns scanned networks", async () => {
    vi.mocked(getWifiNetworks).mockResolvedValueOnce({
      data: [
        {
          ssid: "HomeNet",
          bssid: "11:22:33:44:55:66",
          signalPercent: 70,
          channel: 1,
          frequencyMhz: 2412,
          security: "WPA/WPA2",
        },
      ],
      source: "helper",
    });

    const response = await GET();
    const json = (await response.json()) as { meta: { count: number } };

    expect(response.status).toBe(200);
    expect(json.meta.count).toBe(1);
  });
});
