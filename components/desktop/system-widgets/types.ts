import type { LucideIcon } from "lucide-react";

export type UptimeParts = {
  days: number;
  hours: number;
  minutes: number;
};

export type ResourceWidgetItem = {
  label: string;
  value: string;
  progress: number;
  colorClassName: string;
  icon: LucideIcon;
};

export type NetworkWidgetData = {
  downloadText: string;
  uploadText: string;
  ipAddress: string;
  hostname: string;
  interfaceName: string;
  ssid: string;
};

export type QuickStatItem = {
  label: string;
  value: string;
  sub: string;
};

export type SystemWidgetsViewModel = {
  uptime: UptimeParts;
  resources: ResourceWidgetItem[];
  network: NetworkWidgetData;
  quickStats: QuickStatItem[];
};
