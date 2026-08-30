import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMetrics, mockStacks, mockHealth } = vi.hoisted(() => ({
  mockMetrics: vi.fn(),
  mockStacks: vi.fn(),
  mockHealth: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/service", () => ({
  getSystemMetricsSnapshot: mockMetrics,
}));
vi.mock("@/lib/server/modules/apps/stacks-repository", () => ({
  listInstalledStacksFromDb: mockStacks,
}));
vi.mock("@/lib/server/modules/apps/health-repository", () => ({
  listAppHealth: mockHealth,
}));

import {
  getSystemSummary,
  resetSystemSummaryCache,
} from "@/lib/server/modules/system/summary-service";

const METRICS = {
  timestamp: "2026-08-30T12:00:00Z",
  hostname: "homeio",
  platform: "linux",
  architecture: "arm64",
  uptimeSeconds: 86_400,
  cpu: { oneMinute: 1, fiveMinute: 1, fifteenMinute: 1, normalizedPercent: 12.5 },
  memory: { usedBytes: 2_000_000_000, totalBytes: 8_000_000_000, freeBytes: 6_000_000_000, usedPercent: 25 },
  storage: { mountPath: "/", usedBytes: 100_000_000_000, totalBytes: 1_000_000_000_000, availableBytes: 900_000_000_000, usedPercent: 10 },
  temperature: { mainCelsius: 44, maxCelsius: 51, coresCelsius: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  resetSystemSummaryCache();
  mockMetrics.mockResolvedValue(METRICS);
  mockStacks.mockResolvedValue([
    { appId: "jellyfin", displayName: "Jellyfin", status: "installed", webUiPort: 8096 },
  ]);
  mockHealth.mockResolvedValue([{ appId: "jellyfin", state: "healthy" }]);
});

describe("getSystemSummary", () => {
  it("answers host, resources and apps in one payload", async () => {
    const summary = await getSystemSummary();

    expect(summary.host).toMatchObject({ hostname: "homeio", architecture: "arm64" });
    expect(summary.cpu).toMatchObject({ usagePercent: 12.5, temperatureCelsius: 44 });
    expect(summary.apps).toEqual([
      { appId: "jellyfin", name: "Jellyfin", status: "installed", webUiPort: 8096, health: "healthy" },
    ]);
  });

  it("computes percentages rather than making the client do it", async () => {
    const summary = await getSystemSummary();

    expect(summary.memory.usagePercent).toBe(25);
    expect(summary.storage.usagePercent).toBe(10);
  });

  it("reports null rather than zero when a total is unknown", async () => {
    // Zero would read as "0% used", which is a different claim from "unknown".
    mockMetrics.mockResolvedValueOnce({ ...METRICS, memory: { usedBytes: null, totalBytes: null, freeBytes: null, usedPercent: null } });

    const summary = await getSystemSummary();

    expect(summary.memory.usagePercent).toBeNull();
  });

  it("serves several pollers from one scrape", async () => {
    const clock = vi.fn(() => 1_000);
    await getSystemSummary(clock);
    clock.mockReturnValue(2_000);
    await getSystemSummary(clock);
    clock.mockReturnValue(3_000);
    await getSystemSummary(clock);

    expect(mockMetrics).toHaveBeenCalledTimes(1);
  });

  it("refreshes once the cache lapses", async () => {
    const clock = vi.fn(() => 1_000);
    await getSystemSummary(clock);
    clock.mockReturnValue(7_000);
    await getSystemSummary(clock);

    expect(mockMetrics).toHaveBeenCalledTimes(2);
  });

  it("caches a build that took longer than the TTL", async () => {
    // The bug this replaces: the entry was stamped with the time the call
    // started, so a scrape slower than the TTL wrote an already-expired entry
    // and every poller triggered a fresh one. Measured at 8.6s on a Mac; a Pi
    // is slower still.
    let current = 1_000;
    const clock = () => current;
    mockMetrics.mockImplementationOnce(async () => {
      current += 9_000;
      return METRICS;
    });

    await getSystemSummary(clock);
    current += 100;
    await getSystemSummary(clock);

    expect(mockMetrics).toHaveBeenCalledTimes(1);
  });

  it("still answers when health is unavailable", async () => {
    // Auto-heal is optional; the summary must not fail because it is off.
    mockHealth.mockRejectedValueOnce(new Error("no table"));

    const summary = await getSystemSummary();

    expect(summary.apps[0].health).toBeNull();
  });

  it("falls back to the app id when an app has no display name", async () => {
    mockStacks.mockResolvedValueOnce([
      { appId: "custom-thing", displayName: null, status: "installed", webUiPort: null },
    ]);

    const summary = await getSystemSummary();

    expect(summary.apps[0].name).toBe("custom-thing");
  });
});
