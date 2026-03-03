/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

const mockUseCurrentUser = vi.fn();
const mockUseSystemMetrics = vi.fn();
const mockUseNetworkStatus = vi.fn();
const mockUseWifiNetworks = vi.fn();
const mockUseLocalFolderShares = vi.fn();
const mockUseNetworkShares = vi.fn();
const mockUseDockerStatsSnapshot = vi.fn();
const mockUseStoreCatalog = vi.fn();

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUser: () => mockUseCurrentUser(),
}));

vi.mock("@/hooks/useSystemMetrics", () => ({
  useSystemMetrics: () => mockUseSystemMetrics(),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockUseNetworkStatus(),
}));

vi.mock("@/hooks/useWifiNetworks", () => ({
  useWifiNetworks: () => mockUseWifiNetworks(),
}));

vi.mock("@/hooks/useLocalFolderShares", () => ({
  useLocalFolderShares: () => mockUseLocalFolderShares(),
}));

vi.mock("@/hooks/useNetworkShares", () => ({
  useNetworkShares: () => mockUseNetworkShares(),
}));

vi.mock("@/hooks/useDockerStats", () => ({
  useDockerStatsSnapshot: () => mockUseDockerStatsSnapshot(),
}));

vi.mock("@/hooks/useStoreCatalog", () => ({
  useStoreCatalog: (options?: unknown) => mockUseStoreCatalog(options),
}));

import { useSettingsBackend } from "@/hooks/useSettingsBackend";

function setDefaultMocks() {
  mockUseCurrentUser.mockReturnValue({
    data: {
      id: "u1",
      username: "ahmed",
    },
    isLoading: false,
    error: null,
  });

  mockUseSystemMetrics.mockReturnValue({
    data: {
      timestamp: "2026-02-27T10:00:00.000Z",
      hostname: "home-node",
      platform: "linux",
      uptimeSeconds: 90061,
      cpu: {
        oneMinute: 0.3,
        fiveMinute: 0.2,
        fifteenMinute: 0.1,
        normalizedPercent: 32,
      },
      memory: {
        totalBytes: 8 * 1024 * 1024 * 1024,
        freeBytes: 3 * 1024 * 1024 * 1024,
        usedBytes: 5 * 1024 * 1024 * 1024,
        usedPercent: 62.5,
      },
      temperature: {
        mainCelsius: 47.2,
        maxCelsius: 49,
        coresCelsius: [46.5, 47.8],
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
        ssid: "HomeNet",
        bssid: "11:22:33:44",
        signalPercent: 78,
        txRateMbps: 150,
        downloadMbps: 30,
        uploadMbps: 10,
        ipv4: "192.168.1.20",
        ipv6: null,
        availableNetworks: [],
      },
      process: {
        pid: 123,
        uptimeSeconds: 7200,
        nodeVersion: "v22.17.0",
      },
      storage: {
        mountPath: "/DATA",
        totalBytes: 4 * 1024 * 1024 * 1024 * 1024,
        availableBytes: 2200 * 1024 * 1024 * 1024,
        usedBytes: 1800 * 1024 * 1024 * 1024,
        usedPercent: 45,
      },
    },
    isLoading: false,
    error: null,
  });

  mockUseNetworkStatus.mockReturnValue({
    data: {
      connected: true,
      iface: "wlan0",
      ssid: "HomeNet",
      ipv4: "192.168.1.20",
      signalPercent: 78,
    },
    isLoading: false,
    error: null,
  });

  mockUseWifiNetworks.mockReturnValue({
    data: [
      {
        ssid: "HomeNet",
        bssid: "11:22:33:44",
        signalPercent: 80,
        channel: 6,
        frequencyMhz: 2437,
        security: "wpa2",
      },
      {
        ssid: "GuestNet",
        bssid: "aa:bb:cc:dd",
        signalPercent: 42,
        channel: 11,
        frequencyMhz: 2462,
        security: "wpa2",
      },
    ],
    isLoading: false,
    error: null,
  });

  mockUseDockerStatsSnapshot.mockReturnValue({
    stats: [
      {
        id: "container123456789",
        name: "plex",
        state: "running",
        cpuPercent: 3.4,
        memoryUsed: 512 * 1024 * 1024,
        memoryLimit: 2 * 1024 * 1024 * 1024,
        memoryPercent: 25,
        networkRx: 10,
        networkTx: 15,
        blockRead: 1,
        blockWrite: 2,
      },
    ],
    isLoading: false,
    error: null,
  });

  mockUseLocalFolderShares.mockReturnValue({
    data: [
      {
        id: "local-1",
        shareName: "Media",
        sourcePath: "Media",
        sharedPath: "Shared/Media",
        isMounted: true,
        isExported: true,
      },
    ],
    isLoading: false,
    error: null,
  });

  mockUseNetworkShares.mockReturnValue({
    data: [
      {
        id: "network-1",
        host: "nas.local",
        share: "Public",
        username: "guest",
        mountPath: "Network/nas.local/Public",
        isMounted: true,
      },
    ],
    isLoading: false,
    error: null,
  });

  mockUseStoreCatalog.mockReturnValue({
    data: [
      {
        id: "plex",
        name: "Plex",
        description: "Media",
        platform: "Docker",
        categories: ["Media"],
        logoUrl: null,
        repositoryUrl: "https://example.com",
        stackFile: "plex.yml",
        status: "installed",
        webUiPort: 32400,
        updateAvailable: true,
        localDigest: "sha256:11111111111111111111111111111111",
        remoteDigest: "sha256:22222222222222222222222222222222",
      },
    ],
    isLoading: false,
    error: null,
  });
}

describe("useSettingsBackend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      }),
    );
  });

  it("maps live settings data and capability flags", () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useSettingsBackend(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.general.hostname).toBe("home-node");
    expect(result.current.general.uptime).toContain("1 day");
    expect(result.current.network.iface).toBe("wlan0");
    expect(result.current.network.topSsids).toEqual(["HomeNet", "GuestNet"]);
    expect(result.current.storage.mountPath).toBe("/DATA");
    expect(result.current.storage.shares).toHaveLength(2);
    expect(result.current.docker.containers).toHaveLength(1);
    expect(result.current.updates.entries).toHaveLength(1);
    expect(result.current.capabilities.general.telemetry.disabled).toBe(true);
    expect(result.current.capabilities.updates.checkForUpdates.disabled).toBe(false);
  });

  it("marks sections unavailable when source hooks fail", () => {
    mockUseSystemMetrics.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("metrics down"),
    });

    mockUseNetworkStatus.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("network down"),
    });

    mockUseDockerStatsSnapshot.mockReturnValue({
      stats: [],
      isLoading: false,
      error: "docker down",
    });

    mockUseStoreCatalog.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error("store down"),
    });

    const client = createTestQueryClient();
    const { result } = renderHook(() => useSettingsBackend(), {
      wrapper: createWrapper(client),
    });

    expect(result.current.general.unavailable).toBe(true);
    expect(result.current.network.unavailable).toBe(true);
    expect(result.current.docker.unavailable).toBe(true);
    expect(result.current.updates.unavailable).toBe(true);
  });

  it("triggers update check mutation and invalidates store catalog", async () => {
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useSettingsBackend(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.actions.checkForUpdates();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/store/check-updates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.storeCatalog,
    });
  });
});
