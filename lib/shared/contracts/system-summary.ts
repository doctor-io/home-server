/**
 * One request that answers everything a dashboard integration asks for, so a
 * poller does not have to fan out across metrics, apps and health.
 */
export type SystemSummaryApp = {
  appId: string;
  name: string;
  status: string;
  webUiPort: number | null;
  health: string | null;
};

/**
 * The link the server is actually reachable on. `wired` is inferred from the
 * absence of an SSID on a connected default interface, which is how the metrics
 * snapshot already distinguishes the two.
 */
export type SystemSummaryNetwork = {
  type: "wifi" | "wired" | null;
  /** SSID on Wi-Fi, interface name on a wired link. */
  name: string | null;
  iface: string | null;
  ipv4: string | null;
  signalPercent: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
};

export type SystemSummary = {
  generatedAt: string;
  host: {
    hostname: string;
    platform: string;
    architecture: string;
    uptimeSeconds: number;
    version: string;
  };
  cpu: { usagePercent: number | null; temperatureCelsius: number | null };
  memory: { usedBytes: number | null; totalBytes: number | null; usagePercent: number | null };
  storage: { usedBytes: number | null; totalBytes: number | null; usagePercent: number | null };
  /** Optional: older servers answer without it, so clients must not require it. */
  network?: SystemSummaryNetwork;
  apps: SystemSummaryApp[];
};
