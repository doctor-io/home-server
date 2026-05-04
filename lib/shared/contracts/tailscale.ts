export type TailscaleConfigPublic = {
  tailnet: string;
  hasApiKey: boolean;
};

export type TailscaleConfigSaveRequest = {
  tailnet: string;
  apiKey: string;
};

export type TailscaleInstallResult = {
  installed: boolean;
  activated: boolean;
  stdout: string;
  stderr: string;
};

export type TailscaleStatusPublic = {
  installed: boolean;
  tunAvailable: boolean;
  running: boolean;
  connected: boolean;
  backendState: string | null;
  hostname: string | null;
  dnsName: string | null;
  tailscaleIps: string[];
  issue: "missing_tun" | "service_unavailable" | null;
  error: string | null;
};
