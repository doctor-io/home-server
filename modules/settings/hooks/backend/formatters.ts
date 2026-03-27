import type { ContainerStats } from "@/lib/shared/contracts/docker";

export function formatUptime(uptimeSeconds: number | null | undefined) {
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

export function formatGigabytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) {
    return "--";
  }

  const gigabytes = bytes / 1024 ** 3;
  return `${gigabytes.toFixed(1)} GB`;
}

export function formatBytes(bytes: number | null | undefined) {
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

export function mapContainerToViewModel(container: ContainerStats) {
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

export function controlDisabled(disabledReason: string) {
  return {
    disabled: true,
    disabledReason,
  };
}
