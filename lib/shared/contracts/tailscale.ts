export type TailscaleConfigPublic = {
  tailnet: string;
  hasApiKey: boolean;
};

export type TailscaleConfigSaveRequest = {
  tailnet: string;
  apiKey: string;
};
