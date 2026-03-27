import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    METRICS_PUBLISH_INTERVAL_MS: 60_000,
    SSE_HEARTBEAT_MS: 60_000,
  },
}));

vi.mock("@/lib/server/modules/system/service", () => ({
  getSystemMetricsSnapshot: vi.fn(async () => ({
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
  })),
}));

import { GET } from "@/app/api/v1/system/stream/route";

describe("GET /api/v1/system/stream", () => {
  it("returns SSE stream and emits initial metrics frame", async () => {
    const controller = new AbortController();
    const request = new Request("http://localhost/api/v1/system/stream", {
      signal: controller.signal,
    });

    const response = await GET(request);

    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("X-Accel-Buffering")).toBe("no");

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();

    const chunk = await reader?.read();
    const text = new TextDecoder().decode(chunk?.value);

    expect(text).toContain("event: metrics.updated");
    expect(text).toContain('"hostname":"pi"');

    controller.abort();
    await reader?.cancel();
  });
});
