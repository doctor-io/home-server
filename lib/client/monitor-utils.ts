import type { ContainerStats } from "@/lib/shared/contracts/docker";

/**
 * Calculate total stats from Docker containers
 */
export function calculateDockerTotals(containers: ContainerStats[]) {
  if (containers.length === 0) {
    return {
      totalCpu: 0,
      totalMemoryMB: 0,
      totalNetworkRx: 0,
      totalNetworkTx: 0,
      totalDiskRead: 0,
      totalDiskWrite: 0,
      runningCount: 0,
    };
  }

  return containers.reduce(
    (acc, container) => ({
      totalCpu: acc.totalCpu + container.cpuPercent,
      totalMemoryMB: acc.totalMemoryMB + container.memoryUsed / 1024 / 1024,
      totalNetworkRx: acc.totalNetworkRx + container.networkRx,
      totalNetworkTx: acc.totalNetworkTx + container.networkTx,
      totalDiskRead: acc.totalDiskRead + container.blockRead,
      totalDiskWrite: acc.totalDiskWrite + container.blockWrite,
      runningCount:
        acc.runningCount + (container.state === "running" ? 1 : 0),
    }),
    {
      totalCpu: 0,
      totalMemoryMB: 0,
      totalNetworkRx: 0,
      totalNetworkTx: 0,
      totalDiskRead: 0,
      totalDiskWrite: 0,
      runningCount: 0,
    },
  );
}

/**
 * Convert Docker container to process-like format for table display
 */
export function containerToProcess(container: ContainerStats) {
  return {
    name: container.name,
    status: (container.state === "running"
      ? "Running"
      : container.state === "exited"
        ? "Sleeping"
        : "Background") as "Running" | "Sleeping" | "Background",
    pid: parseInt(container.id.slice(0, 8), 16) % 99999, // Pseudo PID from container ID
    cpu: container.cpuPercent,
    memory: container.memoryUsed / 1024 / 1024, // Convert to MB
    network: (container.networkRx + container.networkTx) / 1024 / 1024 / 2, // Average RX+TX in MB
    disk: (container.blockRead + container.blockWrite) / 1024 / 1024 / 2, // Average read+write in MB
  };
}

/**
 * Nudge a value randomly within min/max bounds (for animations)
 */
export function nudge(
  value: number,
  min: number,
  max: number,
  delta = 2.2,
): number {
  const next = value + (Math.random() * 2 - 1) * delta;
  return Math.min(max, Math.max(min, Number(next.toFixed(1))));
}

/**
 * Get status badge color based on container/process state
 */
export function getStatusBadgeColor(
  status: "Running" | "Sleeping" | "Background" | string,
): string {
  switch (status) {
    case "Running":
    case "running":
      return "bg-status-green/15 text-status-green";
    case "Sleeping":
    case "exited":
      return "bg-status-amber/15 text-status-amber";
    default:
      return "bg-secondary/60 text-muted-foreground";
  }
}
