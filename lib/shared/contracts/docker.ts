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

export type DockerStatsResponse = {
  data: ContainerStats[];
};

export type DockerStatsStreamEvent = {
  type: "stats.updated" | "heartbeat";
  data: ContainerStats[] | { timestamp: string };
};
