import type { SystemBackupListResponse } from "@/lib/shared/contracts/system";

export type ScheduledRebootConfig = {
  enabled: boolean;
  frequency: "daily" | "weekly";
  dayOfWeek:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  time: string;
};

export type BackupRunAcceptedResponse = {
  accepted: boolean;
  backup: SystemBackupListResponse["backups"][number];
};
