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
  stdout: string;
  stderr: string;
};

export type TailscaleStatusPublic = {
  installed: boolean;
  running: boolean;
  connected: boolean;
  backendState: string | null;
  hostname: string | null;
  dnsName: string | null;
  tailscaleIps: string[];
  error: string | null;
};
