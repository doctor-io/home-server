"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { withClientTiming } from "@/lib/client/logger";
import type { ContainerStats } from "@/lib/shared/contracts/docker";
import type { StoreAppSummary } from "@/lib/shared/contracts/apps";
import { queryKeys } from "@/lib/shared/query-keys";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useDockerStatsSnapshot } from "@/hooks/useDockerStats";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import { useWifiNetworks } from "@/hooks/useWifiNetworks";

const NOT_AVAILABLE_REASON = "Not available yet: backend endpoint not implemented";
const SAVE_DISABLED_REASON = "Not available in this pass: no save endpoint";

function formatUptime(uptimeSeconds: number | null | undefined) {
  if (uptimeSeconds === null || uptimeSeconds === undefined || !Number.isFinite(uptimeSeconds)) {
    return "--";
  }

  const totalSeconds = Math.max(0, Math.floor(uptimeSeconds));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);

  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"}, ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (hours > 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}, ${minutes} min`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return "<1 min";
}

function formatGigabytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }

  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}

function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }

  if (bytes < 1024 ** 2) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function mapContainerState(state: string): "running" | "stopped" | "restarting" {
  const normalized = state.trim().toLowerCase();
  if (normalized === "running") return "running";
  if (normalized === "restarting") return "restarting";
  return "stopped";
}

function mapContainerToViewModel(container: ContainerStats) {
  return {
    id: container.id,
    name: container.name,
    image: `id:${container.id.slice(0, 12)}`,
    status: mapContainerState(container.state),
    ports: "--",
    cpu: `${container.cpuPercent.toFixed(1)}%`,
    memory: formatBytes(container.memoryUsed),
  };
}

function shortDigest(value: string | null) {
  if (!value) return "--";
  const trimmed = value.startsWith("sha256:") ? value.slice(7) : value;
  return trimmed.slice(0, 12);
}

function mapUpdateToViewModel(app: StoreAppSummary) {
  return {
    id: app.id,
    name: app.name,
    current: shortDigest(app.localDigest),
    available: shortDigest(app.remoteDigest),
    type: "app" as const,
  };
}

function controlDisabled(disabledReason = NOT_AVAILABLE_REASON) {
  return {
    disabled: true,
    disabledReason,
  };
}

async function checkStoreUpdatesRequest() {
  return withClientTiming(
    {
      layer: "hook",
      action: "hooks.useSettingsBackend.checkUpdates",
      meta: {
        endpoint: "/api/v1/store/check-updates",
      },
    },
    async () => {
      const response = await fetch("/api/v1/store/check-updates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check for updates (${response.status})`);
      }

      return response.json();
    },
  );
}

export function useSettingsBackend() {
  const queryClient = useQueryClient();

  const currentUserQuery = useCurrentUser();
  const systemMetricsQuery = useSystemMetrics();
  const networkStatusQuery = useNetworkStatus();
  const wifiNetworksQuery = useWifiNetworks();
  const dockerStatsSnapshot = useDockerStatsSnapshot();
  const updatesQuery = useStoreCatalog({ updatesOnly: true });

  const checkUpdatesMutation = useMutation({
    mutationFn: checkStoreUpdatesRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog });
    },
  });

  const general = useMemo(() => {
    const metrics = systemMetricsQuery.data;
    const memory = metrics?.memory;

    return {
      hostname: metrics?.hostname ?? "--",
      platform: metrics?.platform ?? "--",
      kernel: metrics?.process.nodeVersion ?? "--",
      architecture: "--",
      uptime: formatUptime(metrics?.uptimeSeconds),
      appVersion: "--",
      username: currentUserQuery.data?.username ?? "--",
      cpuSummary:
        metrics?.cpu.normalizedPercent !== undefined
          ? `${metrics.cpu.normalizedPercent.toFixed(0)}% load`
          : "--",
      memorySummary:
        memory && memory.totalBytes > 0
          ? `${formatGigabytes(memory.usedBytes)} / ${formatGigabytes(memory.totalBytes)}`
          : "--",
      temperatureSummary:
        metrics?.temperature.mainCelsius !== null && metrics?.temperature.mainCelsius !== undefined
          ? `${metrics.temperature.mainCelsius.toFixed(1)} C`
          : "--",
      processUptime: formatUptime(metrics?.process.uptimeSeconds),
      isLoading: systemMetricsQuery.isLoading || currentUserQuery.isLoading,
      unavailable: Boolean(systemMetricsQuery.error),
      warning:
        systemMetricsQuery.error instanceof Error
          ? "System metrics unavailable. Showing placeholders where needed."
          : currentUserQuery.error instanceof Error
            ? "User identity unavailable."
            : null,
    };
  }, [
    currentUserQuery.data?.username,
    currentUserQuery.error,
    currentUserQuery.isLoading,
    systemMetricsQuery.data,
    systemMetricsQuery.error,
    systemMetricsQuery.isLoading,
  ]);

  const network = useMemo(() => {
    const status = networkStatusQuery.data;
    const networks = wifiNetworksQuery.data ?? [];

    return {
      connected: status?.connected ?? false,
      iface: status?.iface ?? "--",
      ipv4: status?.ipv4 ?? "--",
      ssid: status?.ssid ?? "--",
      signalPercent:
        status?.signalPercent !== null && status?.signalPercent !== undefined
          ? `${status.signalPercent}%`
          : "--",
      wifiCount: networks.length,
      topSsids: networks
        .map((networkEntry) => networkEntry.ssid)
        .filter((ssid) => ssid.trim().length > 0)
        .slice(0, 3),
      isLoading: networkStatusQuery.isLoading || wifiNetworksQuery.isLoading,
      unavailable: Boolean(networkStatusQuery.error),
      warning:
        networkStatusQuery.error instanceof Error
          ? "Network status unavailable."
          : wifiNetworksQuery.error instanceof Error
            ? "Wi-Fi scan unavailable."
            : null,
    };
  }, [
    networkStatusQuery.data,
    networkStatusQuery.error,
    networkStatusQuery.isLoading,
    wifiNetworksQuery.data,
    wifiNetworksQuery.error,
    wifiNetworksQuery.isLoading,
  ]);

  const docker = useMemo(() => {
    const containers = dockerStatsSnapshot.stats.map(mapContainerToViewModel);

    return {
      containers,
      total: containers.length,
      running: containers.filter((container) => container.status === "running").length,
      images: "--",
      engineVersion: "--",
      composeVersion: "--",
      storageDriver: "--",
      cgroupDriver: "--",
      isLoading: dockerStatsSnapshot.isLoading,
      unavailable: Boolean(dockerStatsSnapshot.error),
      warning: dockerStatsSnapshot.error ? "Docker stats unavailable." : null,
    };
  }, [dockerStatsSnapshot.error, dockerStatsSnapshot.isLoading, dockerStatsSnapshot.stats]);

  const updates = useMemo(() => {
    const entries = (updatesQuery.data ?? []).map(mapUpdateToViewModel);

    return {
      entries,
      availableCount: entries.length,
      isLoading: updatesQuery.isLoading,
      unavailable: Boolean(updatesQuery.error),
      warning: updatesQuery.error ? "Updates list unavailable." : null,
      isChecking: checkUpdatesMutation.isPending,
      checkError:
        checkUpdatesMutation.error instanceof Error
          ? checkUpdatesMutation.error.message
          : null,
    };
  }, [
    checkUpdatesMutation.error,
    checkUpdatesMutation.isPending,
    updatesQuery.data,
    updatesQuery.error,
    updatesQuery.isLoading,
  ]);

  const capabilities = {
    general: {
      hostname: controlDisabled(),
      timezone: controlDisabled(),
      language: controlDisabled(),
      autoStart: controlDisabled(),
      remoteAccess: controlDisabled(),
      telemetry: controlDisabled(),
    },
    network: {
      gateway: controlDisabled(),
      dnsPrimary: controlDisabled(),
      dnsSecondary: controlDisabled(),
      domain: controlDisabled(),
      dhcp: controlDisabled(),
      ipv6: controlDisabled(),
      wol: controlDisabled(),
      mtu: controlDisabled(),
      addRule: controlDisabled(),
    },
    docker: {
      lifecycle: controlDisabled(),
      autoRestart: controlDisabled(),
      logRotation: controlDisabled(),
      defaultNetwork: controlDisabled(),
      pruneImages: controlDisabled(),
      pruneVolumes: controlDisabled(),
    },
    updates: {
      updateRow: controlDisabled(),
      updateAll: controlDisabled(),
      autoCheck: controlDisabled(),
      channel: controlDisabled(),
      autoUpdatePolicy: controlDisabled(),
      checkForUpdates: {
        disabled: false,
        disabledReason: undefined,
      },
    },
    unsupportedSectionReason: NOT_AVAILABLE_REASON,
    saveBySection: {
      general: false,
      network: false,
      storage: false,
      docker: false,
      users: false,
      security: false,
      notifications: false,
      backup: false,
      updates: false,
      power: false,
    },
    saveDisabledReason: SAVE_DISABLED_REASON,
  };

  return {
    general,
    network,
    docker,
    updates,
    capabilities,
    actions: {
      checkForUpdates: checkUpdatesMutation.mutateAsync,
    },
  };
}
