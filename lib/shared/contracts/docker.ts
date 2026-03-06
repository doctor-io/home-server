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

/** Shape returned by both the REST endpoint and the SSE "stats.updated" event. */
export type DockerStatsPayload = {
  containers: ContainerStats[];
  /** false when the Docker daemon socket is unreachable. */
  daemonAvailable: boolean;
};

export type DockerStatsResponse = {
  data: DockerStatsPayload;
};

export type DockerStatsStreamEvent = {
  type: "stats.updated" | "heartbeat";
  data: DockerStatsPayload | { timestamp: string };
};
