"use client";

import { useMemo } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDesktopPreferences } from "@/hooks/useDesktopPreferences";
import { useInstalledApps } from "@/modules/apps/hooks/useInstalledApps";
import { useNetworkStatus } from "@/modules/system/hooks/useNetworkStatus";
import { useSystemUpdateStatus } from "@/modules/system/hooks/useSystemUpdateStatus";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
import { safePercent } from "@/modules/system/components/status-bar/utils";
import { useStatusNotifications } from "@/modules/system/components/status-bar/use-status-notifications";

export function useStatusBarData() {
  const { data: metrics, isError: isMetricsError } = useSystemMetrics();
  const { data: networkStatus, isError: isNetworkError } = useNetworkStatus();
  const { data: apps } = useInstalledApps();
  const { data: currentUser } = useCurrentUser();
  const { notificationPreferences } = useDesktopPreferences();
  const { data: systemUpdates } = useSystemUpdateStatus();

  const serverName = metrics?.hostname ?? "ServerLab";
  const cpuPercent = safePercent(metrics?.cpu.normalizedPercent);
  const memoryPercent = safePercent(metrics?.memory.usedPercent);
  const diskPercent = safePercent(metrics?.storage?.usedPercent);
  const stoppedAppsCount = (apps ?? []).filter(
    (app) => app.status === "stopped" || app.status === "paused",
  ).length;

  const batteryPercent =
    typeof metrics?.battery.percent === "number"
      ? safePercent(metrics.battery.percent)
      : null;
  const batteryText = metrics?.battery.hasBattery ? `${batteryPercent ?? "--"}%` : "AC";

  const isWifiConnected = Boolean(
    networkStatus?.connected ?? metrics?.wifi.connected,
  );
  const showWifiError = (isMetricsError && isNetworkError) || !isWifiConnected;
  const wifiIconClassName = showWifiError
    ? "size-4 text-status-red"
    : "size-4 text-status-green";

  const { notifications, unreadCount, markAllRead, clearAll } = useStatusNotifications({
    metricsTimestamp: metrics?.timestamp ?? null,
    cpuPercent,
    memoryPercent,
    diskPercent,
    temperatureCelsius:
      typeof metrics?.temperature.mainCelsius === "number"
        ? metrics.temperature.mainCelsius
        : null,
    hostname: metrics?.hostname ?? "ServerLab",
    uptimeSeconds: metrics?.uptimeSeconds ?? 0,
    stoppedAppsCount,
    username: currentUser?.username,
    updateAvailable: Boolean(systemUpdates?.updateAvailable),
    latestVersion: systemUpdates?.latestVersion ?? null,
    preferences: notificationPreferences,
  });

  return useMemo(
    () => ({
      metrics,
      networkStatus,
      serverName,
      username: currentUser?.username ?? null,
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
      networkStatus,
      isWifiConnected,
      markAllRead,
      clearAll,
      metrics,
      notifications,
      serverName,
      currentUser?.username,
      unreadCount,
      wifiIconClassName,
    ],
  );
}
