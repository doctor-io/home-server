"use client";

import { useMemo } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useInstalledApps } from "@/hooks/useInstalledApps";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { safePercent } from "@/components/desktop/status-bar/utils";
import { useStatusNotifications } from "@/components/desktop/status-bar/use-status-notifications";

export function useStatusBarData() {
  const { data: metrics, isError: isMetricsError } = useSystemMetrics();
  const { data: apps } = useInstalledApps();
  const { data: currentUser } = useCurrentUser();

  const serverName = metrics?.hostname ?? "ServerLab";
  const cpuPercent = safePercent(metrics?.cpu.normalizedPercent);
  const memoryPercent = safePercent(metrics?.memory.usedPercent);
  const stoppedAppsCount = (apps ?? []).filter((app) => app.status === "stopped").length;

  const batteryPercent =
    typeof metrics?.battery.percent === "number"
      ? safePercent(metrics.battery.percent)
      : null;
  const batteryText = metrics?.battery.hasBattery ? `${batteryPercent ?? "--"}%` : "AC";

  const isWifiConnected = Boolean(metrics?.wifi.connected);
  const showWifiError = isMetricsError || !isWifiConnected;
  const wifiIconClassName = showWifiError
    ? "size-4 text-status-red"
    : "size-4 text-status-green";

  const { notifications, unreadCount, markAllRead, clearAll } = useStatusNotifications({
    metricsTimestamp: metrics?.timestamp ?? null,
    cpuPercent,
    memoryPercent,
    hostname: metrics?.hostname ?? "ServerLab",
    uptimeSeconds: metrics?.uptimeSeconds ?? 0,
    stoppedAppsCount,
    username: currentUser?.username,
  });

  return useMemo(
    () => ({
      metrics,
      serverName,
      batteryText,
      isWifiConnected,
      isMetricsError,
      wifiIconClassName,
      notifications,
      unreadCount,
      markAllRead,
      clearNotifications: clearAll,
    }),
    [
      batteryText,
      isMetricsError,
      isWifiConnected,
      markAllRead,
      clearAll,
      metrics,
      notifications,
      serverName,
      unreadCount,
      wifiIconClassName,
    ],
  );
}
