/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchDesktopNotificationEvent } from "@/lib/desktop/notification-events";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

const mockUseSystemMetrics = vi.fn();
const mockUseInstalledApps = vi.fn();
const mockUseCurrentUser = vi.fn();
const mockUseNetworkStatus = vi.fn();
const mockUseDesktopPreferences = vi.fn();
const mockUseSystemUpdateStatus = vi.fn();

vi.mock("@/modules/system/hooks/useSystemMetrics", () => ({
  useSystemMetrics: () => mockUseSystemMetrics(),
}));

vi.mock("@/modules/apps/hooks/useInstalledApps", () => ({
  useInstalledApps: () => mockUseInstalledApps(),
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/modules/system/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

vi.mock("@/hooks/useDesktopPreferences", () => ({
  useDesktopPreferences: () => mockUseDesktopPreferences(),
}));

vi.mock("@/modules/system/hooks/useSystemUpdateStatus", () => ({
  useSystemUpdateStatus: () => mockUseSystemUpdateStatus(),
}));

import { useStatusBarData } from "@/modules/system/components/status-bar/use-status-bar-data";

function buildMetrics(params?: {
  timestamp?: string;
  cpuPercent?: number;
  memoryPercent?: number;
  wifiConnected?: boolean;
}) {
  const {
    timestamp = "2026-02-22T23:08:00.000Z",
    cpuPercent = 92.1,
    memoryPercent = 93.8,
    wifiConnected = true,
  } = params ?? {};

  return {
    timestamp,
    hostname: "pi4-home",
    platform: "linux 6.8",
    uptimeSeconds: 12_345,
    cpu: {
      oneMinute: 0.9,
      fiveMinute: 0.8,
      fifteenMinute: 0.7,
      normalizedPercent: cpuPercent,
    },
    memory: {
      totalBytes: 8 * 1024 * 1024 * 1024,
      freeBytes: 512 * 1024 * 1024,
      usedBytes: 7.5 * 1024 * 1024 * 1024,
      usedPercent: memoryPercent,
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
      connected: wifiConnected,
      iface: "wlan0",
      ssid: "HomeNet",
      bssid: "11:22:33",
      signalPercent: 67,
      txRateMbps: 144.4,
      downloadMbps: 24.8,
      uploadMbps: 8.3,
      ipv4: "192.168.1.22",
      ipv6: "fe80::1234",
      availableNetworks: [],
    },
    process: {
      pid: 1234,
      uptimeSeconds: 2345,
      nodeVersion: "v22.2.0",
    },
  };
}

describe("useStatusBarData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ notifications: [] }),
      }),
    );

    mockUseSystemMetrics.mockReturnValue({ data: buildMetrics(), isError: false });
    mockUseInstalledApps.mockReturnValue({
      data: [{ id: "1", name: "Immich", status: "stopped", updatedAt: "2026-02-22T23:00:00.000Z" }],
    });
    mockUseCurrentUser.mockReturnValue({ data: { id: "u1", username: "admin" } });
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
    mockUseDesktopPreferences.mockReturnValue({
      notificationPreferences: {
        systemAlertsEnabled: true,
        updateNotificationsEnabled: true,
        backupReportsEnabled: true,
        securityEventsEnabled: false,
        cpuAlertThresholdPercent: 85,
        memoryAlertThresholdPercent: 85,
        diskAlertThresholdPercent: 90,
        temperatureAlertThresholdCelsius: 80,
      },
    });
    mockUseSystemUpdateStatus.mockReturnValue({
      data: {
        currentVersion: "0.1.0",
        latestVersion: "0.1.0",
        updateAvailable: false,
        checkedAt: null,
      },
    });
  });

  it("builds ui state and supports read/clear notification actions", async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useStatusBarData(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
    });

    expect(result.current.serverName).toBe("pi4-home");
    expect(result.current.batteryText).toBe("74%");

    act(() => {
      result.current.markAllRead();
    });

    expect(result.current.unreadCount).toBe(0);

    act(() => {
      result.current.clearNotifications();
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it("limits cpu warning notifications to one per minute", async () => {
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(() => useStatusBarData(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(
        result.current.notifications.filter((notification) => notification.title === "CPU Warning")
          .length,
      ).toBe(1);
    });

    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({ timestamp: "2026-02-22T23:08:30.000Z", cpuPercent: 95 }),
      isError: false,
    });
    rerender();

    await waitFor(() => {
      expect(
        result.current.notifications.filter((notification) => notification.title === "CPU Warning")
          .length,
      ).toBe(1);
    });

    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({ timestamp: "2026-02-22T23:09:05.000Z", cpuPercent: 96 }),
      isError: false,
    });
    rerender();

    await waitFor(() => {
      expect(
        result.current.notifications.filter((notification) => notification.title === "CPU Warning")
          .length,
      ).toBe(2);
    });
  });

  it("keeps existing notification timestamp across metric refreshes", async () => {
    const oldTimestamp = new Date(Date.now() - 125_000).toISOString();

    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({ timestamp: oldTimestamp, cpuPercent: 20, memoryPercent: 20 }),
      isError: false,
    });
    // A live alert, since the list now only holds events with a condition that
    // can end — the always-on "System Snapshot" this used to watch is gone.
    mockUseInstalledApps.mockReturnValue({
      data: [{ id: "1", name: "Immich", status: "stopped", updatedAt: "2026-02-22T23:00:00.000Z" }],
    });
    mockUseCurrentUser.mockReturnValue({ data: { id: "u1", username: "admin" } });

    const client = createTestQueryClient();
    const { result, rerender } = renderHook(() => useStatusBarData(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      const alert = result.current.notifications.find(
        (notification) => notification.title === "Apps Attention",
      );
      expect(alert?.time).toMatch(/min ago/);
    });

    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({ timestamp: new Date().toISOString(), cpuPercent: 20, memoryPercent: 20 }),
      isError: false,
    });
    rerender();

    const refreshedAlert = result.current.notifications.find(
      (notification) => notification.title === "Apps Attention",
    );
    expect(refreshedAlert?.time).not.toBe("0s ago");
  });

  it("marks wifi icon as error style when disconnected", () => {
    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({ wifiConnected: false, cpuPercent: 15, memoryPercent: 20 }),
      isError: false,
    });
    mockUseInstalledApps.mockReturnValue({ data: [] });
    mockUseCurrentUser.mockReturnValue({ data: null });
    mockUseNetworkStatus.mockReturnValue({
      data: {
        connected: false,
        iface: "wlan0",
        ssid: null,
        ipv4: null,
        signalPercent: null,
      },
      isError: false,
    });

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStatusBarData(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.isWifiConnected).toBe(false);
    expect(result.current.wifiIconClassName).toContain("text-status-red");
  });

  it("emits update notifications when Homeio updates are available", async () => {
    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({ cpuPercent: 20, memoryPercent: 20 }),
      isError: false,
    });
    mockUseInstalledApps.mockReturnValue({ data: [] });
    mockUseSystemUpdateStatus.mockReturnValue({
      data: {
        currentVersion: "0.1.0",
        latestVersion: "0.1.1",
        updateAvailable: true,
        checkedAt: "2026-02-22T23:08:00.000Z",
      },
    });

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStatusBarData(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(
        result.current.notifications.find(
          (notification) => notification.title === "Homeio Update Available",
        ),
      ).toBeTruthy();
    });
  });

  it("adds local backup report notifications from desktop events", async () => {
    mockUseSystemMetrics.mockReturnValue({
      data: buildMetrics({ cpuPercent: 20, memoryPercent: 20 }),
      isError: false,
    });
    mockUseInstalledApps.mockReturnValue({ data: [] });

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStatusBarData(), {
      wrapper: createWrapper(client),
    });

    act(() => {
      dispatchDesktopNotificationEvent({
        id: "backup-run-1",
        title: "Backup Completed",
        message: "Backup backup-1 finished successfully.",
      });
    });

    await waitFor(() => {
      expect(
        result.current.notifications.find(
          (notification) => notification.title === "Backup Completed",
        ),
      ).toBeTruthy();
    });
  });
});
