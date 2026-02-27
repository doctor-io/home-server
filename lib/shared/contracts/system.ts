export type CpuLoad = {
  oneMinute: number;
  fiveMinute: number;
  fifteenMinute: number;
  normalizedPercent: number;
};

export type MemoryUsage = {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usedPercent: number;
};

export type TemperatureMetrics = {
  mainCelsius: number | null;
  maxCelsius: number | null;
  coresCelsius: number[];
};

export type BatteryMetrics = {
  hasBattery: boolean;
  isCharging: boolean;
  percent: number | null;
  timeRemainingMinutes: number | null;
  acConnected: boolean | null;
  manufacturer: string | null;
  cycleCount: number | null;
  designedCapacityWh: number | null;
  maxCapacityWh: number | null;
  designToMaxCapacityPercent: number | null;
};

export type StorageMetrics = {
  mountPath: string;
  totalBytes: number;
  availableBytes: number;
  usedBytes: number;
  usedPercent: number;
};

export type WifiAccessPoint = {
  ssid: string;
  channel: number | null;
  qualityPercent: number | null;
  security: string | null;
};

export type WifiMetrics = {
  connected: boolean;
  iface: string | null;
  ssid: string | null;
  bssid: string | null;
  signalPercent: number | null;
  txRateMbps: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
  ipv4: string | null;
  ipv6: string | null;
  availableNetworks: WifiAccessPoint[];
};

export type SystemMetricsSnapshot = {
  timestamp: string;
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpu: CpuLoad;
  memory: MemoryUsage;
  temperature: TemperatureMetrics;
  battery: BatteryMetrics;
  storage?: StorageMetrics;
  wifi: WifiMetrics;
  process: {
    pid: number;
    uptimeSeconds: number;
    nodeVersion: string;
  };
};

export type SystemStreamEvent = {
  type: "metrics.updated" | "heartbeat";
  data: SystemMetricsSnapshot | { timestamp: string };
};
