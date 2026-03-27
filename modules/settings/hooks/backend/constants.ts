import type { ScheduledRebootConfig } from "@/modules/settings/hooks/backend/types";

export const NOT_AVAILABLE_REASON = "Not available yet: backend endpoint not implemented";
export const SAVE_DISABLED_REASON = "Not available in this pass: no save endpoint";
export const CHECK_UPDATES_COOLDOWN_MS = 30_000;
export const DEFAULT_BACKUP_ROOT = "/DATA/Backups/homeio";

export const DEFAULT_SCHEDULED_REBOOT_CONFIG: ScheduledRebootConfig = {
  enabled: false,
  frequency: "weekly",
  dayOfWeek: "sunday",
  time: "03:00",
};
