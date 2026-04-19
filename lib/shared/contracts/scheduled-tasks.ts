import { z } from "zod";

export type ScheduledTaskType = "shell" | "script" | "restart-app" | "backup" | "pull-images";

export type ScheduledTaskConfig =
  | { type: "shell"; command: string }
  | { type: "script"; script: string }
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

// 5-field cron: basic validation (digits, *, commas, hyphens, slashes)
const cronField = /^(\*|[0-9,\-*/]+)$/;
export const CRON_EXPRESSION_REGEX = /^(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)\s+(\*|[0-9,\-*/]+)$/;

const taskConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("shell"), command: z.enum(SHELL_COMMAND_ALLOWLIST) }),
  z.object({ type: z.literal("script"), script: z.string().min(1).max(32_768) }),
  z.object({ type: z.literal("restart-app"), appId: z.string().min(1), appName: z.string().min(1) }),
  z.object({ type: z.literal("backup") }),
  z.object({ type: z.literal("pull-images") }),
]);

export const createScheduledTaskSchema = z.object({
  label: z.string().min(1).max(200),
  taskType: z.enum(["shell", "script", "restart-app", "backup", "pull-images"]),
  taskConfig: taskConfigSchema,
  cronExpression: z.string().regex(CRON_EXPRESSION_REGEX, "Invalid cron expression"),
  enabled: z.boolean().optional(),
});

export const updateScheduledTaskSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  taskType: z.enum(["shell", "script", "restart-app", "backup", "pull-images"]).optional(),
  taskConfig: taskConfigSchema.optional(),
  cronExpression: z.string().regex(CRON_EXPRESSION_REGEX, "Invalid cron expression").optional(),
  enabled: z.boolean().optional(),
});
