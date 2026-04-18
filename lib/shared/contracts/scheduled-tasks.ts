export type ScheduledTaskType = "shell" | "restart-app" | "backup" | "pull-images";

export type ScheduledTaskConfig =
  | { type: "shell"; command: string }
  | { type: "restart-app"; appId: string; appName: string }
  | { type: "backup" }
  | { type: "pull-images" };

export type ScheduledTaskRecord = {
  id: string;
  label: string;
  taskType: ScheduledTaskType;
  taskConfig: ScheduledTaskConfig;
  cronExpression: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: "success" | "error" | null;
  lastRunOutput: string | null;
  nextRunAt: string | null;
  createdAt: string;
};

export type CreateScheduledTaskInput = {
  label: string;
  taskType: ScheduledTaskType;
  taskConfig: ScheduledTaskConfig;
  cronExpression: string;
  enabled?: boolean;
};

export type UpdateScheduledTaskInput = {
  label?: string;
  taskType?: ScheduledTaskType;
  taskConfig?: ScheduledTaskConfig;
  cronExpression?: string;
  enabled?: boolean;
};

export type ScheduledTasksListResponse = {
  tasks: ScheduledTaskRecord[];
};

export const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Daily at 3 AM", value: "0 3 * * *" },
  { label: "Weekly (Sun 3 AM)", value: "0 3 * * 0" },
  { label: "Monthly (1st, 3 AM)", value: "0 3 1 * *" },
  { label: "Custom…", value: "custom" },
] as const;

export const SHELL_COMMAND_ALLOWLIST = [
  "df -h",
  "docker system prune -f",
  "docker image prune -af",
  "docker volume prune -f",
  "apt-get update",
  "apt-get upgrade -y",
  "apt-get autoremove -y",
  "journalctl --vacuum-size=500M",
  "sync && echo 3 > /proc/sys/vm/drop_caches",
] as const;
