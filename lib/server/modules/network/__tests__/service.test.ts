import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/network/helper-client", () => ({
  connectWifiFromHelper: vi.fn(),
  disconnectWifiFromHelper: vi.fn(),
  getNetworkStatusFromHelper: vi.fn(),
  scanWifiNetworksFromHelper: vi.fn(),
  isNetworkHelperUnavailableError: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/service", () => ({
  getSystemMetricsSnapshot: vi.fn(),
}));

import {
  connectNetwork,
  disconnectNetwork,
  getNetworkStatus,
  getWifiNetworks,
} from "@/lib/server/modules/network/service";
import type { NetworkServiceError } from "@/lib/server/modules/network/service";
import {
  connectWifiFromHelper,
  disconnectWifiFromHelper,
  getNetworkStatusFromHelper,
  isNetworkHelperUnavailableError,
  scanWifiNetworksFromHelper,
} from "@/lib/server/modules/network/helper-client";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";

describe("network service", () => {
  it("returns helper network status when helper is available", async () => {
    vi.mocked(getNetworkStatusFromHelper).mockResolvedValueOnce({
      connected: true,
      iface: "wlan0",
      ssid: "HomeNet",
      ipv4: "192.168.1.44",
      signalPercent: 78,
    });

    const result = await getNetworkStatus({
      requestId: "req-1",
    });

    expect(result.source).toBe("helper");
    expect(result.data.connected).toBe(true);
    expect(getSystemMetricsSnapshot).not.toHaveBeenCalled();
  });

  it("falls back to metrics when helper is unavailable", async () => {
    vi.mocked(getNetworkStatusFromHelper).mockRejectedValueOnce(
      new Error("helper down"),
    );
    vi.mocked(scanWifiNetworksFromHelper).mockRejectedValueOnce(
      new Error("helper down"),
    );
    vi.mocked(isNetworkHelperUnavailableError).mockReturnValue(true);
    vi.mocked(getSystemMetricsSnapshot).mockResolvedValue({
      timestamp: "2026-02-23T00:00:00.000Z",
      hostname: "homeio",
      platform: "linux",
      uptimeSeconds: 1_000,
      cpu: {
        oneMinute: 0,
        fiveMinute: 0,
        fifteenMinute: 0,
        normalizedPercent: 0,
      },
      memory: {
        totalBytes: 1,
        freeBytes: 1,
        usedBytes: 0,
        usedPercent: 0,
      },
      temperature: {
        mainCelsius: null,
        maxCelsius: null,
        coresCelsius: [],
      },
      battery: {
        hasBattery: false,
        isCharging: false,
        percent: null,
        timeRemainingMinutes: null,
        acConnected: null,
        manufacturer: null,
        cycleCount: null,
        designedCapacityWh: null,
        maxCapacityWh: null,
        designToMaxCapacityPercent: null,
      },
      wifi: {
        connected: true,
        iface: "wlan0",
        ssid: "FallbackNet",
        bssid: null,
        signalPercent: 55,
        txRateMbps: null,
        downloadMbps: null,
        uploadMbps: null,
        ipv4: "192.168.1.12",
        ipv6: null,
        availableNetworks: [
          {
            ssid: "FallbackNet",
            channel: 11,
            qualityPercent: 55,
            security: "WPA2",
          },
        ],
      },
      process: {
        pid: 1,
        uptimeSeconds: 1,
        nodeVersion: "v22",
      },
    });

    const statusResult = await getNetworkStatus();
    const networksResult = await getWifiNetworks();

    expect(statusResult.source).toBe("fallback");
    expect(statusResult.data.ssid).toBe("FallbackNet");
    expect(networksResult.source).toBe("fallback");
    expect(networksResult.data[0]?.ssid).toBe("FallbackNet");
  });

  it("validates connect payload and maps helper errors", async () => {
    await expect(connectNetwork({})).rejects.toMatchObject({
      code: "invalid_request",
      statusCode: 400,
    } satisfies Partial<NetworkServiceError>);

    const helperError = Object.assign(new Error("auth failed"), {
      name: "NetworkHelperError",
      code: "auth_failed",
      statusCode: 401,
    });
    vi.mocked(connectWifiFromHelper).mockRejectedValueOnce(helperError);

    await expect(connectNetwork({ ssid: "HomeNet", password: "bad" })).rejects.toMatchObject(
      {
        code: "auth_failed",
        statusCode: 401,
      } satisfies Partial<NetworkServiceError>,
    );
  });

  it("validates disconnect payload and forwards helper result", async () => {
    await expect(disconnectNetwork({ iface: "" })).rejects.toMatchObject({
      code: "invalid_request",
      statusCode: 400,
    } satisfies Partial<NetworkServiceError>);

    vi.mocked(disconnectWifiFromHelper).mockResolvedValueOnce({
      connected: false,
      iface: "wlan0",
      ssid: null,
      ipv4: null,
      signalPercent: null,
    });

    const result = await disconnectNetwork({
      iface: "wlan0",
    });

    expect(result.connected).toBe(false);
  });
});
