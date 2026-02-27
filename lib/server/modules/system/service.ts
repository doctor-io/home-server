import "server-only";

import { LruCache } from "@/lib/server/cache/lru";
import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import os from "node:os";
import { statfs } from "node:fs/promises";
import path from "node:path";
import si from "systeminformation";
import {
  getNetworkStatusFromHelper,
  isNetworkHelperUnavailableError,
} from "@/lib/server/modules/network/helper-client";

const metricsCache = new LruCache<SystemMetricsSnapshot>(
  8,
  serverEnv.METRICS_CACHE_TTL_MS,
);

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Number(value.toFixed(2)), 100));
}

function toNumber(value: number | bigint) {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return value;
}

async function collectStorageMetrics() {
  try {
    const configuredRoot = serverEnv.FILES_ROOT;
    const targetPath = path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(process.cwd(), configuredRoot);
    const filesystemStats = await statfs(targetPath);

    const blockSize = toNumber(filesystemStats.bsize);
    const totalBlocks = toNumber(filesystemStats.blocks);
    const availableBlocks = toNumber(filesystemStats.bavail);
    const totalBytes = Math.max(Math.round(blockSize * totalBlocks), 0);
    const availableBytes = Math.max(Math.round(blockSize * availableBlocks), 0);
    const usedBytes = Math.max(totalBytes - availableBytes, 0);
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;

    return {
      mountPath: targetPath,
      totalBytes,
      availableBytes,
      usedBytes,
      usedPercent: clampPercent(usedPercent),
    };
  } catch (error) {
    logServerAction({
      level: "warn",
      layer: "service",
      action: "system.metrics.storage",
      status: "error",
      message: "Unable to collect storage metrics",
      error,
    });
    return null;
  }
}

function toNullableMetric(
  value: number | undefined,
  options?: {
    precision?: number;
    allowZero?: boolean;
  },
) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;

  const allowZero = options?.allowZero ?? false;
  if (!allowZero && value <= 0) return null;

  const precision = options?.precision ?? 1;
  return Number(value.toFixed(precision));
}

function toNullablePercent(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(Math.round(value), 100));
}

function toNullableText(value: string | undefined | null) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toDesignToMaxCapacityPercent(
  designedCapacityWh: number | null,
  maxCapacityWh: number | null,
) {
  if (designedCapacityWh === null || maxCapacityWh === null) return null;
  if (maxCapacityWh <= 0) return null;

  return Number(((maxCapacityWh / designedCapacityWh) * 100).toFixed(1));
}

async function withFallback<T>(
  action: string,
  run: () => Promise<T>,
  fallback: T,
) {
  try {
    return await run();
  } catch (error) {
    logServerAction({
      level: "warn",
      layer: "service",
      action,
      status: "error",
      error,
      message: "systeminformation probe failed; using fallback",
    });
    return fallback;
  }
}

async function collectSnapshot(): Promise<SystemMetricsSnapshot> {
  const [oneMinute, fiveMinute, fifteenMinute] = os.loadavg();
  const cpuCores = os.cpus().length || 1;
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(totalBytes - freeBytes, 0);
  const defaultCpuPercent = Math.min((oneMinute / cpuCores) * 100, 100);

  const [
    currentLoad,
    cpuTemperature,
    batteryData,
    wifiConnections,
    wifiNetworks,
    networkInterfaces,
    networkStats,
    storageMetrics,
  ] = await Promise.all([
    withFallback("system.metrics.currentLoad", () => si.currentLoad(), null),
    withFallback(
      "system.metrics.cpuTemperature",
      () => si.cpuTemperature(),
      null,
    ),
    withFallback("system.metrics.battery", () => si.battery(), null),
    withFallback(
      "system.metrics.wifiConnections",
      () => si.wifiConnections(),
      [],
    ),
    withFallback("system.metrics.wifiNetworks", () => si.wifiNetworks(), []),
    withFallback(
      "system.metrics.networkInterfaces",
      () => si.networkInterfaces(),
      [],
    ),
    withFallback("system.metrics.networkStats", () => si.networkStats(), []),
    collectStorageMetrics(),
  ]);

  const mainTemperature = toNullableMetric(cpuTemperature?.main);
  const normalizedCoreTemps = (cpuTemperature?.cores ?? [])
    .map((coreTemp) => toNullableMetric(coreTemp))
    .filter((coreTemp): coreTemp is number => coreTemp !== null);
  const maxTemperature = toNullableMetric(cpuTemperature?.max);

  // Try to get WiFi status from NetworkManager D-Bus helper first (more reliable)
  let helperStatus: Awaited<ReturnType<typeof getNetworkStatusFromHelper>> | null = null;
  try {
    helperStatus = await getNetworkStatusFromHelper();
  } catch (error) {
    if (!isNetworkHelperUnavailableError(error)) {
      logServerAction({
        level: "warn",
        layer: "service",
        action: "system.metrics.network.helper",
        status: "error",
        message: "Failed to get network status from D-Bus helper",
        error,
      });
    }
  }

  const primaryWifiConnection =
    wifiConnections.find(
      (connection) =>
        connection.iface.length > 0 || connection.ssid.trim().length > 0,
    ) ?? null;
  const primaryNetworkInterface = primaryWifiConnection
    ? (networkInterfaces.find(
        (networkInterface) =>
          networkInterface.iface === primaryWifiConnection.iface,
      ) ?? null)
    : (networkInterfaces.find((networkInterface) => networkInterface.default) ??
      null);

  // Prefer D-Bus helper data for WiFi status (more reliable with NetworkManager)
  const connectedSsid = helperStatus?.ssid?.trim() ?? primaryWifiConnection?.ssid.trim() ?? "";
  const isWifiConnected = connectedSsid.length > 0;
  const preferredIface =
    helperStatus?.iface ?? primaryNetworkInterface?.iface ?? primaryWifiConnection?.iface ?? null;
  const primaryNetworkStats =
    networkStats.find((stats) => stats.iface === preferredIface) ??
    networkStats.find((stats) => stats.operstate === "up") ??
    networkStats[0] ??
    null;
  const designedCapacityWh = batteryData?.hasBattery
    ? toNullableMetric(batteryData.designedCapacity, {
        precision: 0,
      })
    : null;
  const maxCapacityWh = batteryData?.hasBattery
    ? toNullableMetric(batteryData.maxCapacity, {
        precision: 0,
      })
    : null;
  const availableNetworks = wifiNetworks
    .filter((network) => network.ssid.trim().length > 0)
    .sort((left, right) => (right.quality ?? 0) - (left.quality ?? 0))
    .slice(0, 6)
    .map((network) => ({
      ssid: network.ssid.trim(),
      channel: Number.isFinite(network.channel) ? network.channel : null,
      qualityPercent: toNullablePercent(network.quality),
      security:
        network.security.length > 0
          ? network.security.join(", ")
          : network.rsnFlags.length > 0
            ? network.rsnFlags.join(", ")
            : null,
    }));
  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.release()}`,
    uptimeSeconds: os.uptime(),
    cpu: {
      oneMinute,
      fiveMinute,
      fifteenMinute,
      normalizedPercent: clampPercent(
        currentLoad?.currentLoad ?? defaultCpuPercent,
      ),
    },
    memory: {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
    },
    temperature: {
      mainCelsius: mainTemperature,
      maxCelsius: maxTemperature,
      coresCelsius: normalizedCoreTemps,
    },
    battery: {
      hasBattery: Boolean(batteryData?.hasBattery),
      isCharging: Boolean(batteryData?.isCharging),
      percent: batteryData?.hasBattery
        ? toNullablePercent(batteryData.percent)
        : null,
      timeRemainingMinutes:
        batteryData?.hasBattery &&
        typeof batteryData.timeRemaining === "number" &&
        batteryData.timeRemaining >= 0
          ? Math.round(batteryData.timeRemaining)
          : null,
      acConnected:
        typeof batteryData?.acConnected === "boolean"
          ? batteryData.acConnected
          : null,
      manufacturer: batteryData?.hasBattery
        ? toNullableText(batteryData?.manufacturer)
        : null,
      cycleCount:
        batteryData?.hasBattery &&
        typeof batteryData.cycleCount === "number" &&
        Number.isFinite(batteryData.cycleCount) &&
        batteryData.cycleCount >= 0
          ? Math.round(batteryData.cycleCount)
          : null,
      designedCapacityWh,
      maxCapacityWh,
      designToMaxCapacityPercent: toDesignToMaxCapacityPercent(
        designedCapacityWh,
        maxCapacityWh,
      ),
    },
    storage: storageMetrics ?? undefined,
    wifi: {
      connected: helperStatus?.connected ?? isWifiConnected,
      iface:
        helperStatus?.iface ?? (primaryWifiConnection?.iface || primaryNetworkInterface?.iface || null),
      ssid: helperStatus?.ssid ?? (isWifiConnected ? connectedSsid : null),
      bssid: primaryWifiConnection?.bssid || null,
      signalPercent: helperStatus?.signalPercent ?? toNullablePercent(primaryWifiConnection?.quality),
      txRateMbps: toNullableMetric(primaryWifiConnection?.txRate, {
        precision: 1,
        allowZero: true,
      }),
      downloadMbps: toNullableMetric(
        primaryNetworkStats
          ? (primaryNetworkStats.rx_sec * 8) / 1_000_000
          : undefined,
        {
          precision: 2,
          allowZero: true,
        },
      ),
      uploadMbps: toNullableMetric(
        primaryNetworkStats
          ? (primaryNetworkStats.tx_sec * 8) / 1_000_000
          : undefined,
        {
          precision: 2,
          allowZero: true,
        },
      ),
      ipv4:
        helperStatus?.ipv4 ?? (primaryNetworkInterface && primaryNetworkInterface.ip4.length > 0
          ? primaryNetworkInterface.ip4
          : null),
      ipv6:
        primaryNetworkInterface && primaryNetworkInterface.ip6.length > 0
          ? primaryNetworkInterface.ip6
          : null,
      availableNetworks,
    },
    process: {
      pid: process.pid,
      uptimeSeconds: process.uptime(),
      nodeVersion: process.version,
    },
  };
}

export async function getSystemMetricsSnapshot(options?: {
  bypassCache?: boolean;
}) {
  const startedAt = performance.now();

  if (!options?.bypassCache) {
    const cached = metricsCache.get("latest");
    if (cached) {
      logServerAction({
        level: "debug",
        layer: "service",
        action: "system.metrics.snapshot",
        status: "success",
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        meta: {
          cache: "hit",
        },
      });
      return cached;
    }
  }

  const snapshot = await collectSnapshot();
  metricsCache.set("latest", snapshot);

  logServerAction({
    level: "debug",
    layer: "service",
    action: "system.metrics.snapshot",
    status: "success",
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    meta: {
      cache: "miss",
    },
  });

  return snapshot;
}
