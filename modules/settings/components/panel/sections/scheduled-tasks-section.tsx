"use client";

import { useState } from "react";
import {
  CRON_PRESETS,
  SHELL_COMMAND_ALLOWLIST,
  type CreateScheduledTaskInput,
  type ScheduledTaskConfig,
  type ScheduledTaskRecord,
  type ScheduledTaskType,
} from "@/lib/shared/contracts/scheduled-tasks";
import { useScheduledTasks } from "@/modules/settings/hooks/useScheduledTasks";
import { useInstalledApps } from "@/modules/apps/hooks/useInstalledApps";
import { SectionDivider } from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET, SETTINGS_BADGE_SURFACE } from "@/modules/settings/components/panel/surface";
import { Check, AlertTriangle, Clock, Play, Trash2, Plus, ChevronDownIcon as ChevronDown } from "@/components/icons/platform-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TaskFormState = {
  label: string;
  taskType: ScheduledTaskType;
  shellCommand: string;
  appId: string;
  appName: string;
  cronPreset: string;
  customCron: string;
};

const TASK_TYPE_LABELS: Record<ScheduledTaskType, string> = {
  shell: "Shell Command",
  "restart-app": "Restart App",
  backup: "Run Backup",
  "pull-images": "Pull Docker Images",
};

const DEFAULT_FORM: TaskFormState = {
  label: "",
  taskType: "shell",
  shellCommand: SHELL_COMMAND_ALLOWLIST[0],
  appId: "",
  appName: "",
  cronPreset: CRON_PRESETS[1].value,
  customCron: "0 3 * * *",
};

function formatRelative(iso: string | null, future = false): string {
  if (!iso) return "Never";
  const diff = new Date(iso).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60_000);
  const suffix = future ? (diff > 0 ? " from now" : " ago") : " ago";
  if (minutes < 1) return future && diff > 0 ? "< 1 min" : "Just now";
  if (minutes < 60) return `${minutes}m${suffix}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h${suffix}`;
  return `${Math.floor(hours / 24)}d${suffix}`;
}

function buildConfig(form: TaskFormState): ScheduledTaskConfig {
  if (form.taskType === "shell") return { type: "shell", command: form.shellCommand };
  if (form.taskType === "restart-app") return { type: "restart-app", appId: form.appId, appName: form.appName };
  if (form.taskType === "backup") return { type: "backup" };
  return { type: "pull-images" };
}

function buildCron(form: TaskFormState): string {
  return form.cronPreset === "custom" ? form.customCron : form.cronPreset;
}

function TaskRow({
  task,
  onToggle,
  onRunNow,
  onDelete,
  runningId,
}: {
  task: ScheduledTaskRecord;
  onToggle: () => void;
  onRunNow: () => void;
  onDelete: () => void;
  runningId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = runningId === task.id;

  return (
    <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-0 overflow-hidden")}>
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            task.enabled ? "bg-status-green/15 text-status-green" : "bg-muted/40 text-muted-foreground",
          )}
        >
          <Clock className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{task.label}</div>
          <div className="truncate text-xs text-muted-foreground">
            {TASK_TYPE_LABELS[task.taskType]} · {task.cronExpression}
          </div>
        </div>
        {task.lastRunStatus === "error" && (
          <AlertTriangle className="size-3.5 shrink-0 text-status-red" />
        )}
        {task.lastRunStatus === "success" && (
          <Check className="size-3.5 shrink-0 text-status-green" />
        )}
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div className="border-t border-glass-border/60 px-4 py-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <span className="text-muted-foreground">Last run</span>
            <span className="text-foreground">{formatRelative(task.lastRunAt)}</span>
            <span className="text-muted-foreground">Next run</span>
            <span className="text-foreground">{task.nextRunAt ? formatRelative(task.nextRunAt, true) : "—"}</span>
            {task.lastRunOutput && (
              <>
                <span className="text-muted-foreground">Output</span>
                <span className={cn("font-mono text-[11px] truncate", task.lastRunStatus === "error" ? "text-status-red" : "text-foreground")}>
                  {task.lastRunOutput}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className={cn(
                SETTINGS_BADGE_SURFACE,
                "px-2.5 py-1 text-xs font-medium transition-colors",
                task.enabled
                  ? "text-status-green hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {task.enabled ? "Enabled" : "Disabled"}
            </button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={onRunNow}
              disabled={isRunning}
            >
              <Play className="size-3" />
              {isRunning ? "Running…" : "Run now"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1.5 text-xs text-muted-foreground hover:text-status-red"
              onClick={onDelete}
            >
              <Trash2 className="size-3" />
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateTaskForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: CreateScheduledTaskInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TaskFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const { data: installedApps = [] } = useInstalledApps();

  const patch = (update: Partial<TaskFormState>) => setForm((f) => ({ ...f, ...update }));

  const cronExpression = buildCron(form);
  const labelPlaceholder =
    form.taskType === "shell"
      ? "e.g. Clean Docker images"
      : form.taskType === "restart-app"
        ? "e.g. Restart Jellyfin nightly"
        : form.taskType === "backup"
          ? "e.g. Daily backup"
          : "e.g. Pull latest images";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    if (form.taskType === "restart-app" && !form.appId) return;
    setSubmitting(true);
    try {
      await onSubmit({
        label: form.label.trim(),
        taskType: form.taskType,
        taskConfig: buildConfig(form),
        cronExpression,
        enabled: true,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn(SETTINGS_PANEL_INSET, "flex flex-col gap-4 p-4")}>
      <div className="text-sm font-semibold text-foreground">New Scheduled Task</div>

      {/* Label */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Label</label>
        <input
          required
          value={form.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={labelPlaceholder}
          className="rounded-md border border-glass-border/80 bg-background/42 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Task type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Task type</label>
        <select
          value={form.taskType}
          onChange={(e) => patch({ taskType: e.target.value as ScheduledTaskType })}
          className="rounded-md border border-glass-border/80 bg-background/42 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {(Object.keys(TASK_TYPE_LABELS) as ScheduledTaskType[]).map((t) => (
            <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Shell command picker */}
      {form.taskType === "shell" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Command</label>
          <select
            value={form.shellCommand}
            onChange={(e) => patch({ shellCommand: e.target.value })}
            className="rounded-md border border-glass-border/80 bg-background/42 px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {SHELL_COMMAND_ALLOWLIST.map((cmd) => (
              <option key={cmd} value={cmd}>{cmd}</option>
            ))}
          </select>
        </div>
      )}

      {/* App picker for restart-app */}
      {form.taskType === "restart-app" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">App to restart</label>
          <select
            value={form.appId}
            onChange={(e) => {
              const app = installedApps.find((a) => a.id === e.target.value);
              patch({ appId: e.target.value, appName: app?.name ?? "" });
            }}
            className="rounded-md border border-glass-border/80 bg-background/42 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="">Select app…</option>
            {installedApps.map((app) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Schedule */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Schedule</label>
        <select
          value={form.cronPreset}
          onChange={(e) => patch({ cronPreset: e.target.value })}
          className="rounded-md border border-glass-border/80 bg-background/42 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {CRON_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        {form.cronPreset === "custom" && (
          <input
            value={form.customCron}
            onChange={(e) => patch({ customCron: e.target.value })}
            placeholder="* * * * *"
            className="rounded-md border border-glass-border/80 bg-background/42 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        )}
        <p className="text-[11px] text-muted-foreground/70 font-mono">{cronExpression}</p>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}

export function ScheduledTasksSection() {
  const { tasks, createTask, updateTask, deleteTask, runNow } = useScheduledTasks();
  const [showForm, setShowForm] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  async function handleRunNow(id: string) {
    setRunningId(id);
    try {
      await runNow(id);
    } finally {
      setRunningId(null);
    }
  }

  async function handleCreate(input: CreateScheduledTaskInput) {
    await createTask(input);
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Scheduled Tasks" />

      {tasks.length === 0 && !showForm && (
        <div className="px-2 py-6 text-center text-sm text-muted-foreground">
          No scheduled tasks yet. Create one to automate maintenance.
        </div>
      )}

      <div className="flex flex-col gap-2 pb-1">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            runningId={runningId}
            onToggle={() => updateTask(task.id, { enabled: !task.enabled })}
            onRunNow={() => handleRunNow(task.id)}
            onDelete={() => deleteTask(task.id)}
          />
        ))}

        {showForm && (
          <CreateTaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        )}
      </div>

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mt-1 flex items-center gap-1.5 rounded-md px-2 py-2 text-xs text-muted-foreground/60 transition-colors hover:text-foreground/80"
        >
          <Plus className="size-3.5" />
          Add scheduled task
        </button>
      )}
    </div>
  );
}
