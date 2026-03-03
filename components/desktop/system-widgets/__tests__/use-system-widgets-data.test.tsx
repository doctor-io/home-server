/* @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSystemMetrics = vi.fn();
const mockUseInstalledApps = vi.fn();
const mockUseCurrentWeather = vi.fn();

vi.mock("@/hooks/useSystemMetrics", () => ({
  useSystemMetrics: () => mockUseSystemMetrics(),
}));

vi.mock("@/hooks/useInstalledApps", () => ({
  useInstalledApps: () => mockUseInstalledApps(),
}));

vi.mock("@/hooks/useCurrentWeather", () => ({
  useCurrentWeather: () => mockUseCurrentWeather(),
}));

import { useSystemWidgetsData } from "@/components/desktop/system-widgets/use-system-widgets-data";

function buildMetrics() {
  return {
    timestamp: "2026-02-22T23:08:00.000Z",
    hostname: "pi4-home",
    platform: "linux 6.8",
    uptimeSeconds: 184_140,
    cpu: {
      oneMinute: 0.4,
      fiveMinute: 0.3,
      fifteenMinute: 0.2,
      normalizedPercent: 37.4,
    },
    memory: {
      totalBytes: 8 * 1024 * 1024 * 1024,
      freeBytes: 2 * 1024 * 1024 * 1024,
      usedBytes: 6 * 1024 * 1024 * 1024,
      usedPercent: 75.1,
    },
    temperature: {
      mainCelsius: 48.7,
      maxCelsius: 51.3,
      coresCelsius: [47.8, 48.7, 50.2],
    },
    battery: {
      hasBattery: false,
      isCharging: false,
      percent: null,
      timeRemainingMinutes: null,
      acConnected: true,
      manufacturer: null,
      cycleCount: null,
      designedCapacityWh: null,
      maxCapacityWh: null,
      designToMaxCapacityPercent: null,
    },
    wifi: {
      connected: true,
      iface: "wlan0",
      ssid: "HomeNet",
      bssid: "11:22:33",
      signalPercent: 67,
      txRateMbps: 144.4,
      downloadMbps: 24.8,
      uploadMbps: 8.3,
      ipv4: "192.168.1.22",
      ipv6: "fe80::1234",
      availableNetworks: [
        {
          ssid: "HomeNet",
          channel: 1,
          qualityPercent: 67,
          security: "WPA2",
        },
        {
          ssid: "Guest",
          channel: 11,
          qualityPercent: 42,
          security: "WPA2",
        },
      ],
    },
    process: {
      pid: 1234,
      uptimeSeconds: 2345,
      nodeVersion: "v22.2.0",
    },
  };
}

describe("useSystemWidgetsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps backend hooks into widget model", () => {
    mockUseSystemMetrics.mockReturnValue({ data: buildMetrics() });
    mockUseInstalledApps.mockReturnValue({
      data: [
        { id: "1", name: "Plex", status: "running", updatedAt: "2026-02-22T22:00:00.000Z" },
        { id: "2", name: "Immich", status: "running", updatedAt: "2026-02-22T22:10:00.000Z" },
        { id: "3", name: "Pi-hole", status: "stopped", updatedAt: "2026-02-22T22:20:00.000Z" },
      ],
    });
    mockUseCurrentWeather.mockReturnValue({
      data: {
        timestamp: "2026-02-22T23:08:00.000Z",
        source: "navigator",
        location: {
          label: "Tunis, Tunisia",
          latitude: 36.8,
          longitude: 10.1,
        },
        current: {
          temperatureC: 22.4,
          feelsLikeC: 21.7,
          humidityPercent: 67,
          windSpeedKph: 18.5,
          weatherCode: 2,
          condition: "Partly cloudy",
        },
        dailyForecast: [],
      },
    });

    const { result } = renderHook(() => useSystemWidgetsData());

    expect(result.current.uptime).toEqual({ days: 2, hours: 3, minutes: 9 });
    expect(result.current.resources[0]?.value).toBe("37%");
    expect(result.current.resources[1]?.value).toBe("6.0 / 8.0 GB");
    expect(result.current.resources[2]?.value).toBe("49 C");
    expect(result.current.network).toEqual({
      downloadText: "24.8 Mbps",
      uploadText: "8.3 Mbps",
      ipAddress: "192.168.1.22",
      hostname: "pi4-home",
      interfaceName: "wlan0",
      ssid: "HomeNet",
    });
    expect(result.current.quickStats).toEqual([
      { label: "Running", value: "2", sub: "apps" },
      { label: "Installed", value: "3", sub: "apps" },
      { label: "Networks", value: "2", sub: "nearby" },
      { label: "Weather", value: "22°", sub: "Tunis, Tunisia" },
    ]);
  });

  it("returns safe fallback values when backend data is missing", () => {
    mockUseSystemMetrics.mockReturnValue({ data: undefined });
    mockUseInstalledApps.mockReturnValue({ data: undefined });
    mockUseCurrentWeather.mockReturnValue({ data: undefined });

    const { result } = renderHook(() => useSystemWidgetsData());

    expect(result.current.uptime).toEqual({ days: 0, hours: 0, minutes: 0 });
    expect(result.current.resources[1]?.value).toBe("--");
    expect(result.current.network).toEqual({
      downloadText: "--",
      uploadText: "--",
      ipAddress: "--",
      hostname: "--",
      interfaceName: "--",
      ssid: "offline",
    });
    expect(result.current.quickStats[0]?.value).toBe("0");
    expect(result.current.quickStats[3]).toEqual({
      label: "Weather",
      value: "--",
      sub: "unknown",
    });
  });
});
