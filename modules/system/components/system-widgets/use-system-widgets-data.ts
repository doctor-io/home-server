"use client";

import { Cpu, MemoryStick, Thermometer } from "@/components/icons/platform-icons";
import { useMemo } from "react";
import { useCurrentWeather } from "@/modules/system/hooks/useCurrentWeather";
import { useInstalledApps } from "@/modules/apps/hooks/useInstalledApps";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type {
  QuickStatItem,
  ResourceWidgetItem,
  SystemWidgetsViewModel,
} from "@/modules/system/components/system-widgets/types";
import {
  clampPercent,
  formatMemoryValue,
  formatRateMbps,
  formatTemperatureValue,
  formatWeatherValue,
  toUptimeParts,
} from "@/modules/system/components/system-widgets/utils";

/**
 * Returns a Tailwind background-colour class for a progress bar based on thresholds.
 *  - Below warnThreshold  → green  (normal)
 *  - [warn, crit)         → amber  (warning)
 *  - >= critThreshold     → red    (critical)
 */
function getResourceColor(
  percent: number,
  warnThreshold: number,
  critThreshold: number,
): string {
  if (percent >= critThreshold) return "bg-status-red";
  if (percent >= warnThreshold) return "bg-status-amber";
  return "bg-status-green";
}

export function useSystemWidgetsData(): SystemWidgetsViewModel {
  const { data: metrics } = useSystemMetrics();
  const { data: installedApps } = useInstalledApps();
  const { data: weather } = useCurrentWeather();
  const { data: currentUser } = useCurrentUser();
  const isDemoMode = currentUser?.isDemoMode ?? false;

  return useMemo(() => {
    const cpuPercent = clampPercent(metrics?.cpu.normalizedPercent);
    const memoryPercent = clampPercent(metrics?.memory.usedPercent);
    // Temperature: mainCelsius maps directly to a 0-100 scale (°C → %).
    // Thresholds: warn at 60 °C, critical at 80 °C.
    const temperatureProgress = clampPercent(metrics?.temperature.mainCelsius);

    const resources: ResourceWidgetItem[] = [
      {
        label: "CPU",
        value: `${cpuPercent}%`,
        progress: cpuPercent,
        colorClassName: getResourceColor(cpuPercent, 60, 80),
        icon: Cpu,
      },
      {
        label: "Memory",
        value: formatMemoryValue(metrics?.memory.usedBytes, metrics?.memory.totalBytes),
        progress: memoryPercent,
        colorClassName: getResourceColor(memoryPercent, 70, 85),
        icon: MemoryStick,
      },
      {
        label: "Temperature",
        value: formatTemperatureValue(metrics?.temperature.mainCelsius),
        progress: temperatureProgress,
        colorClassName: getResourceColor(temperatureProgress, 60, 80),
        icon: Thermometer,
      },
    ];

    const apps = installedApps ?? [];
    const runningApps = apps.filter((app) => app.status === "running").length;

    const quickStats: QuickStatItem[] = [
      {
        label: "Running",
        value: `${runningApps}`,
        sub: "apps",
      },
      {
        label: "Installed",
        value: `${apps.length}`,
        sub: "apps",
      },
      {
        label: "Networks",
        value: `${metrics?.wifi.availableNetworks.length ?? 0}`,
        sub: "nearby",
      },
      {
        label: "Weather",
        value: formatWeatherValue(weather?.current.temperatureC),
        sub: weather?.location.label ?? "unknown",
      },
    ];

    return {
      uptime: toUptimeParts(metrics?.uptimeSeconds),
      resources,
      network: {
        downloadText: formatRateMbps(metrics?.wifi.downloadMbps),
        uploadText: formatRateMbps(metrics?.wifi.uploadMbps),
        ipAddress: metrics?.wifi.ipv4 ?? "--",
        hostname: isDemoMode ? "homeio.app" : (metrics?.hostname ?? "--"),
        interfaceName: metrics?.wifi.iface ?? "--",
        ssid: metrics?.wifi.ssid ?? "offline",
        isDemoMode,
      },
      quickStats,
    };
  }, [installedApps, isDemoMode, metrics, weather]);
}
