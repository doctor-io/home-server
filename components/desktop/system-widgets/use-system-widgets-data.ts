"use client";

import { Cpu, MemoryStick, Thermometer } from "lucide-react";
import { useMemo } from "react";
import { useCurrentWeather } from "@/hooks/useCurrentWeather";
import { useInstalledApps } from "@/hooks/useInstalledApps";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import type {
  QuickStatItem,
  ResourceWidgetItem,
  SystemWidgetsViewModel,
} from "@/components/desktop/system-widgets/types";
import {
  clampPercent,
  formatMemoryValue,
  formatRateMbps,
  formatTemperatureValue,
  formatWeatherValue,
  toUptimeParts,
} from "@/components/desktop/system-widgets/utils";

export function useSystemWidgetsData(): SystemWidgetsViewModel {
  const { data: metrics } = useSystemMetrics();
  const { data: installedApps } = useInstalledApps();
  const { data: weather } = useCurrentWeather();

  return useMemo(() => {
    const cpuPercent = clampPercent(metrics?.cpu.normalizedPercent);
    const memoryPercent = clampPercent(metrics?.memory.usedPercent);
    const temperatureProgress = clampPercent(metrics?.temperature.mainCelsius);

    const resources: ResourceWidgetItem[] = [
      {
        label: "CPU",
        value: `${cpuPercent}%`,
        progress: cpuPercent,
        colorClassName: "bg-primary",
        icon: Cpu,
      },
      {
        label: "Memory",
        value: formatMemoryValue(metrics?.memory.usedBytes, metrics?.memory.totalBytes),
        progress: memoryPercent,
        colorClassName: "bg-chart-2",
        icon: MemoryStick,
      },
      {
        label: "Temperature",
        value: formatTemperatureValue(metrics?.temperature.mainCelsius),
        progress: temperatureProgress,
        colorClassName: "bg-status-amber",
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
        hostname: metrics?.hostname ?? "--",
        interfaceName: metrics?.wifi.iface ?? "--",
        ssid: metrics?.wifi.ssid ?? "offline",
      },
      quickStats,
    };
  }, [installedApps, metrics, weather]);
}
