/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSystemMetrics = vi.fn();
const mockUseInstalledApps = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseCurrentWeather = vi.fn();
const mockUseNetworkStatus = vi.fn();
const mockUseWifiNetworks = vi.fn();
const mockUseNetworkActions = vi.fn();

vi.mock("@/hooks/useSystemMetrics", () => ({
  useSystemMetrics: () => mockUseSystemMetrics(),
}));

vi.mock("@/hooks/useInstalledApps", () => ({
  useInstalledApps: () => mockUseInstalledApps(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/hooks/useCurrentWeather", () => ({
  useCurrentWeather: () => mockUseCurrentWeather(),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

vi.mock("@/hooks/useNetworkEventsSse", () => ({
  useNetworkEventsSse: () => ({ status: "connected" }),
}));

vi.mock("@/hooks/useWifiNetworks", () => ({
  useWifiNetworks: () => mockUseWifiNetworks(),
}));

vi.mock("@/hooks/useNetworkActions", () => ({
  useNetworkActions: () => mockUseNetworkActions(),
}));

import { StatusBar } from "@/components/desktop/status-bar";

function buildMetrics(overrides?: Partial<Record<string, unknown>>) {
  const base = {
    timestamp: "2026-02-22T23:08:00.000Z",
    hostname: "pi4-home",
    platform: "linux 6.8",
    uptimeSeconds: 12_345,
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
      usedPercent: 64.2,
    },
    temperature: {
      mainCelsius: 49.2,
      maxCelsius: 52.8,
      coresCelsius: [48.7, 49.2, 51.4],
    },
    battery: {
      hasBattery: true,
      isCharging: false,
      percent: 74,
      timeRemainingMinutes: 112,
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
          ssid: "OfficeNet",
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

  return {
    ...base,
    ...overrides,
  };
}

describe("StatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics(),
      isError: false,
    });
    mockUseInstalledApps.mockReturnValue({
      data: [],
    });
    mockUseCurrentUser.mockReturnValue({
      data: { id: "u1", username: "admin" },
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
        dailyForecast: [
          {
            date: "2026-02-23",
            weatherCode: 1,
            condition: "Mainly clear",
            tempMaxC: 22,
            tempMinC: 14,
          },
          {
            date: "2026-02-24",
            weatherCode: 2,
            condition: "Partly cloudy",
            tempMaxC: 23,
            tempMinC: 15,
          },
        ],
      },
    });
    mockUseNetworkStatus.mockReturnValue({
      data: {
        connected: true,
        iface: "wlan0",
        ssid: "HomeNet",
        ipv4: "192.168.1.22",
        signalPercent: 67,
      },
      isError: false,
    });
    mockUseWifiNetworks.mockReturnValue({
      data: [
        {
          ssid: "HomeNet",
          bssid: "11:22:33",
          signalPercent: 67,
          channel: 1,
          frequencyMhz: 2412,
          security: "WPA2",
        },
        {
          ssid: "OfficeNet",
          bssid: "22:33:44",
          signalPercent: 42,
          channel: 11,
          frequencyMhz: 2462,
          security: "WPA2",
        },
      ],
    });
    mockUseNetworkActions.mockReturnValue({
      connectNetwork: vi.fn(),
      disconnectNetwork: vi.fn(),
      isConnecting: false,
      isDisconnecting: false,
      actionError: null,
    });
  });

  it("renders backend hostname and live percentages", () => {
    render(<StatusBar />);

    expect(screen.getByText("pi4-home")).toBeTruthy();
    expect(screen.getByText("22°")).toBeTruthy();
    expect(screen.getByText("74%")).toBeTruthy();
  });

  it("renders derived backend alerts in notifications", async () => {
    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({
        cpu: {
          oneMinute: 0.9,
          fiveMinute: 0.8,
          fifteenMinute: 0.7,
          normalizedPercent: 92.1,
        },
        memory: {
          totalBytes: 8 * 1024 * 1024 * 1024,
          freeBytes: 512 * 1024 * 1024,
          usedBytes: 7.5 * 1024 * 1024 * 1024,
          usedPercent: 93.8,
        },
      }),
      isError: false,
    });
    mockUseInstalledApps.mockReturnValue({
      data: [
        {
          id: "app-1",
          name: "Immich",
          status: "stopped",
          updatedAt: "2026-02-22T23:00:00.000Z",
        },
      ],
    });

    render(<StatusBar />);

    const notificationButton = screen.getByRole("button", {
      name: "Notifications",
    });
    await waitFor(() => {
      const unreadBadge = within(notificationButton.parentElement as HTMLElement).getByText("3");
      expect(unreadBadge).toBeTruthy();
    });

    fireEvent.click(notificationButton);

    expect(screen.getByText("Memory Warning")).toBeTruthy();
    expect(screen.getByText("CPU Warning")).toBeTruthy();
    expect(screen.getByText("Apps Attention")).toBeTruthy();
  });

  it("marks notifications as read from popover action", async () => {
    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({
        cpu: {
          oneMinute: 0.9,
          fiveMinute: 0.8,
          fifteenMinute: 0.7,
          normalizedPercent: 92.1,
        },
      }),
      isError: false,
    });

    render(<StatusBar />);

    const notificationButton = screen.getByRole("button", {
      name: "Notifications",
    });

    await waitFor(() => {
      expect(within(notificationButton.parentElement as HTMLElement).getByText("1")).toBeTruthy();
    });

    fireEvent.click(notificationButton);
    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

    await waitFor(() => {
      expect(within(notificationButton.parentElement as HTMLElement).queryByText("1")).toBeNull();
    });
  });

  it("clears notifications from popover action", async () => {
    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({
        cpu: {
          oneMinute: 0.9,
          fiveMinute: 0.8,
          fifteenMinute: 0.7,
          normalizedPercent: 92.1,
        },
      }),
      isError: false,
    });

    render(<StatusBar />);

    const notificationButton = screen.getByRole("button", {
      name: "Notifications",
    });

    await waitFor(() => {
      expect(within(notificationButton.parentElement as HTMLElement).getByText("1")).toBeTruthy();
    });

    fireEvent.click(notificationButton);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() => {
      expect(within(notificationButton.parentElement as HTMLElement).queryByText("1")).toBeNull();
    });

    expect(screen.getByText("No alerts right now")).toBeTruthy();
  });

  it("triggers lock and logout actions", () => {
    const onLock = vi.fn();
    const onLogout = vi.fn();

    render(<StatusBar onLock={onLock} onLogout={onLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "Lock screen" }));
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(onLock).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it("renders weather, wifi, and battery details from system metrics", () => {
    render(<StatusBar />);

    fireEvent.click(screen.getByRole("button", { name: "Weather" }));
    expect(screen.getAllByText("Partly cloudy").length).toBeGreaterThan(0);
    expect(screen.getByText("Next 5 Days")).toBeTruthy();
    expect(screen.getByText("Mainly clear")).toBeTruthy();
    expect(screen.queryByText("Snapshot")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "WiFi networks" }));
    expect(screen.getByText("Nearby Networks")).toBeTruthy();
    expect(screen.getAllByText("HomeNet").length).toBeGreaterThan(0);
    expect(screen.getByText("OfficeNet")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Battery status" }));
    expect(screen.getByText("Battery Status")).toBeTruthy();
    expect(screen.getByText("AC Power")).toBeTruthy();
    expect(screen.getByText("Cycle Count")).toBeTruthy();
    expect(screen.getByText("Design / Max")).toBeTruthy();
    expect(screen.getByText("Manufacturer")).toBeTruthy();
    expect(screen.getByText("SONY")).toBeTruthy();
  });

  it("opens a date picker when date is clicked", () => {
    render(<StatusBar />);

    fireEvent.click(screen.getByRole("button", { name: "Open date picker" }));

    expect(screen.getByText("Date Picker")).toBeTruthy();
  });
});
