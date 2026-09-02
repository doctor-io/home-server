import "server-only";

import { listInstalledStacksFromDb } from "@/lib/server/modules/apps/stacks-repository";
import { listAppHealth } from "@/lib/server/modules/apps/health-repository";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";
import type { SystemSummary, SystemSummaryNetwork } from "@/lib/shared/contracts/system-summary";
import type { WifiMetrics } from "@/lib/shared/contracts/system";

export const SUMMARY_CACHE_TTL_MS = 5_000;

type Cached = { at: number; value: SystemSummary };
let cache: Cached | null = null;

/**
 * The `wifi` block already covers a wired link: with no SSID it falls back to
 * the default interface, so an Ethernet server reports connected with an iface
 * and an address and no network name. That is what tells the two apart here.
 */
export function toNetworkSummary(wifi: WifiMetrics | undefined): SystemSummaryNetwork {
  const ssid = wifi?.ssid?.trim() ?? "";
  const iface = wifi?.iface ?? null;
  const connected = Boolean(wifi?.connected);

  return {
    type: !connected ? null : ssid.length > 0 ? "wifi" : "wired",
    name: ssid.length > 0 ? ssid : connected ? iface : null,
    iface,
    ipv4: wifi?.ipv4 ?? null,
    signalPercent: ssid.length > 0 ? (wifi?.signalPercent ?? null) : null,
    downloadMbps: wifi?.downloadMbps ?? null,
    uploadMbps: wifi?.uploadMbps ?? null,
  };
}

function percentOf(used: number | null | undefined, total: number | null | undefined) {
  if (!used || !total || total <= 0) return null;
  return Math.round((used / total) * 1000) / 10;
}

async function build(): Promise<SystemSummary> {
  // Gathered in parallel: three sequential awaits would make the cache miss
  // cost the sum of all three rather than the slowest.
  const [metrics, stacks, health] = await Promise.all([
    getSystemMetricsSnapshot(),
    listInstalledStacksFromDb(),
    listAppHealth().catch(() => []),
  ]);

  const healthByApp = new Map(health.map((entry) => [entry.appId, entry.state]));

  return {
    generatedAt: new Date().toISOString(),
    host: {
      hostname: metrics.hostname,
      platform: metrics.platform,
      architecture: metrics.architecture,
      uptimeSeconds: metrics.uptimeSeconds,
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "unknown",
    },
    cpu: {
      // normalizedPercent, not the raw load average: a load of 4 means
      // something different on 4 cores than on 16, and a dashboard wants the
      // comparable number.
      usagePercent: metrics.cpu?.normalizedPercent ?? null,
      temperatureCelsius: metrics.temperature?.mainCelsius ?? null,
    },
    memory: {
      usedBytes: metrics.memory?.usedBytes ?? null,
      totalBytes: metrics.memory?.totalBytes ?? null,
      // The service already computes this; recomputing risks the two disagreeing.
      usagePercent: metrics.memory?.usedPercent ?? percentOf(metrics.memory?.usedBytes, metrics.memory?.totalBytes),
    },
    storage: {
      usedBytes: metrics.storage?.usedBytes ?? null,
      totalBytes: metrics.storage?.totalBytes ?? null,
      usagePercent: metrics.storage?.usedPercent ?? percentOf(metrics.storage?.usedBytes, metrics.storage?.totalBytes),
    },
    network: toNetworkSummary(metrics.wifi),
    apps: stacks.map((stack) => ({
      appId: stack.appId,
      name: stack.displayName ?? stack.appId,
      status: stack.status,
      webUiPort: stack.webUiPort,
      health: healthByApp.get(stack.appId) ?? null,
    })),
  };
}

/**
 * Cached briefly so that several pollers — a Home Assistant instance, a
 * dashboard, a script — cost one system scrape between them rather than one
 * each. Five seconds is short enough that nobody sees stale numbers.
 *
 * The entry is stamped when the build FINISHES, not when the call started. A
 * metrics scrape on a slow host can take longer than the TTL itself: stamping
 * the start time produced entries that were already expired when written, so
 * the cache never hit and every poller triggered a full scrape — exactly what
 * it exists to prevent. Measured at 8.6s on this machine.
 */
export async function getSystemSummary(clock: () => number = Date.now): Promise<SystemSummary> {
  if (cache && clock() - cache.at < SUMMARY_CACHE_TTL_MS) {
    return cache.value;
  }

  const value = await build();
  cache = { at: clock(), value };
  return value;
}

export function resetSystemSummaryCache() {
  cache = null;
}
