import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/system/service", () => ({
  getSystemMetricsSnapshot: vi.fn(),
}));

import { GET } from "@/app/api/v1/system/metrics/route";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";

describe("GET /api/v1/system/metrics", () => {
  it("returns metrics snapshot with no-store header", async () => {
    vi.mocked(getSystemMetricsSnapshot).mockResolvedValueOnce({
      timestamp: "2026-02-22T12:00:00.000Z",
      hostname: "pi",
      platform: "linux",
      uptimeSeconds: 100,
      cpu: {
        oneMinute: 0.2,
        fiveMinute: 0.1,
        fifteenMinute: 0.1,
        normalizedPercent: 20,
      },
      memory: {
        totalBytes: 1000,
        freeBytes: 500,
        usedBytes: 500,
        usedPercent: 50,
      },
      temperature: {
        mainCelsius: 49.2,
        maxCelsius: 51.1,
        coresCelsius: [48.5, 51.1],
      },
      battery: {
        hasBattery: true,
        isCharging: false,
        percent: 74,
        timeRemainingMinutes: 90,
        acConnected: false,
        manufacturer: "SONY",
        cycleCount: 248,
        designedCapacityWh: 50,
        maxCapacityWh: 45,
        designToMaxCapacityPercent: 111.1,
      },
      wifi: {
        connected: true,
        iface: "wlan0",
        ssid: "HomeNet",
        bssid: "11:22:33",
        signalPercent: 66,
        txRateMbps: 130,
        downloadMbps: 24.8,
        uploadMbps: 8.3,
        ipv4: "192.168.1.22",
        ipv6: "fe80::1234",
        availableNetworks: [],
      },
      process: {
        pid: 123,
        uptimeSeconds: 20,
        nodeVersion: "v22",
      },
    });

    const response = await GET();
    const json = (await response.json()) as { data: { hostname: string } };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.data.hostname).toBe("pi");
  });
});
