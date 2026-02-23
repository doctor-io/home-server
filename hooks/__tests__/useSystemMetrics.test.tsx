/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useSystemMetrics", () => {
  it("loads metrics snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
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
              uptimeSeconds: 10,
              nodeVersion: "v22",
            },
          },
        }),
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useSystemMetrics(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.hostname).toBe("pi");
    expect(fetch).toHaveBeenCalledWith("/api/v1/system/metrics", {
      cache: "no-store",
    });
  });
});
