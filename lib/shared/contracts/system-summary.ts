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
  apps: SystemSummaryApp[];
};
