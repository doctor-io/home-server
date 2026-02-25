import "server-only";

import { request } from "node:http";
import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";

export type ContainerStats = {
  id: string;
  name: string;
  state: string;
  cpuPercent: number;
  memoryUsed: number;
  memoryLimit: number;
  memoryPercent: number;
  networkRx: number;
  networkTx: number;
  blockRead: number;
  blockWrite: number;
};

type DockerContainer = {
  Id: string;
  Names: string[];
  State: string;
  Status: string;
};

type DockerStatsResponse = {
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage?: number[];
    };
    system_cpu_usage: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage: number;
    limit: number;
  };
  networks?: Record<
    string,
    {
      rx_bytes: number;
      tx_bytes: number;
    }
  >;
  blkio_stats: {
    io_service_bytes_recursive?: Array<{
      op: string;
      value: number;
    }>;
  };
};

/**
 * Make HTTP request to Docker socket
 */
function dockerRequest<T>(path: string, method = "GET"): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath: serverEnv.DOCKER_SOCKET_PATH,
        path,
        method,
        headers: {
          Host: "docker",
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let body = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            reject(new Error(`Docker API failed (${res.statusCode}): ${body}`));
          });
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed as T);
          } catch (error) {
            reject(new Error(`Failed to parse Docker response: ${error}`));
          }
        });
      },
    );

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Calculate CPU percentage from Docker stats
 */
function calculateCpuPercent(stats: DockerStatsResponse): number {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;

  if (systemDelta > 0 && cpuDelta > 0) {
    const cpuCount = stats.cpu_stats.online_cpus || 1;
    return Number(((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2));
  }

  return 0;
}

/**
 * Calculate memory percentage
 */
function calculateMemoryPercent(stats: DockerStatsResponse): number {
  if (stats.memory_stats.limit > 0) {
    return Number(
      ((stats.memory_stats.usage / stats.memory_stats.limit) * 100).toFixed(2),
    );
  }
  return 0;
}

/**
 * Get network stats (total RX/TX across all interfaces)
 */
function getNetworkStats(stats: DockerStatsResponse): {
  rx: number;
  tx: number;
} {
  if (!stats.networks) {
    return { rx: 0, tx: 0 };
  }

  let totalRx = 0;
  let totalTx = 0;

  for (const network of Object.values(stats.networks)) {
    totalRx += network.rx_bytes || 0;
    totalTx += network.tx_bytes || 0;
  }

  return { rx: totalRx, tx: totalTx };
}

/**
 * Get block I/O stats
 */
function getBlockStats(stats: DockerStatsResponse): {
  read: number;
  write: number;
} {
  const ioStats = stats.blkio_stats.io_service_bytes_recursive || [];
  let totalRead = 0;
  let totalWrite = 0;

  for (const io of ioStats) {
    if (io.op === "Read") {
      totalRead += io.value;
    } else if (io.op === "Write") {
      totalWrite += io.value;
    }
  }

  return { read: totalRead, write: totalWrite };
}

/**
 * List all containers
 */
export async function listContainers(): Promise<DockerContainer[]> {
  try {
    const containers = await dockerRequest<DockerContainer[]>(
      "/containers/json?all=true",
    );
    return containers;
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "service",
      action: "docker.list-containers",
      status: "error",
      message: "Failed to list Docker containers",
      error,
    });
    return [];
  }
}

/**
 * Get stats for a specific container
 */
export async function getContainerStats(
  containerId: string,
): Promise<DockerStatsResponse | null> {
  try {
    const stats = await dockerRequest<DockerStatsResponse>(
      `/containers/${containerId}/stats?stream=false`,
    );
    return stats;
  } catch (error) {
    logServerAction({
      level: "warn",
      layer: "service",
      action: "docker.container-stats",
      status: "error",
      message: `Failed to get stats for container ${containerId}`,
      error,
    });
    return null;
  }
}

/**
 * Get stats for all containers
 */
export async function getAllContainersStats(): Promise<ContainerStats[]> {
  try {
    const containers = await listContainers();
    const statsPromises = containers.map(async (container) => {
      const stats = await getContainerStats(container.Id);

      if (!stats) {
        return null;
      }

      const network = getNetworkStats(stats);
      const blockIO = getBlockStats(stats);

      return {
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, "") || container.Id.slice(0, 12),
        state: container.State,
        cpuPercent: calculateCpuPercent(stats),
        memoryUsed: stats.memory_stats.usage,
        memoryLimit: stats.memory_stats.limit,
        memoryPercent: calculateMemoryPercent(stats),
        networkRx: network.rx,
        networkTx: network.tx,
        blockRead: blockIO.read,
        blockWrite: blockIO.write,
      } satisfies ContainerStats;
    });

    const results = await Promise.all(statsPromises);
    return results.filter((stat): stat is ContainerStats => stat !== null);
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "service",
      action: "docker.all-stats",
      status: "error",
      message: "Failed to get Docker container stats",
      error,
    });
    return [];
  }
}
