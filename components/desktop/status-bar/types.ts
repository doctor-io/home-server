import type {
  BatteryMetrics,
  SystemMetricsSnapshot,
} from "@/lib/shared/contracts/system";
import type { NetworkStatus } from "@/lib/shared/contracts/network";

export type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
};

export type StatusBarProps = {
  onLock?: () => void;
  onLogout?: () => void;
  isLogoutPending?: boolean;
};

export type StatusPopover = "weather" | "wifi" | "battery" | "notifications" | "date";

export type WifiPopoverProps = {
  metrics: SystemMetricsSnapshot | undefined;
  networkStatus: NetworkStatus | undefined;
  onClose: () => void;
};

export type BatteryPopoverProps = {
  battery: BatteryMetrics | undefined;
  onClose: () => void;
};
