export type InstalledApp = {
  id: string;
  name: string;
  status: "running" | "stopped" | "unknown";
  updatedAt: string;
};
