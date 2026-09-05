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
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import {
  AlertTriangle,
  Check,
  ChevronDownIcon as ChevronDown,
  Clock,
  Play,
  Plus,
  Trash2,
} from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";

type TaskFormState = {
  label: string;
  taskType: ScheduledTaskType;
  shellCommand: string;
  script: string;
  appId: string;
  appName: string;
  cronPreset: string;
  customCron: string;
};

const TASK_TYPE_LABELS: Record<ScheduledTaskType, string> = {
  shell: "Shell Command",
  script: "Custom Script",
  "restart-app": "Restart App",
  backup: "Run Backup",
  "pull-images": "Pull Docker Images",
};

const DEFAULT_FORM: TaskFormState = {
  label: "",
  taskType: "shell",
  shellCommand: SHELL_COMMAND_ALLOWLIST[0],
  script: "",
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
  if (form.taskType === "script") return { type: "script", script: form.script };
  if (form.taskType === "restart-app") return { type: "restart-app", appId: form.appId, appName: form.appName };
  if (form.taskType === "backup") return { type: "backup" };
  return { type: "pull-images" };
}

function buildCron(form: TaskFormState): string {
  return form.cronPreset === "custom" ? form.customCron : form.cronPreset;
}

// ── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-2xs font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls = "h-8 w-full rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none";
const selectCls = "h-8 w-full cursor-pointer appearance-none rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-foreground focus:border-primary/40 focus:outline-none";

// ── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onRunNow,
  onDelete,
  isRunning,
}: {
  task: ScheduledTaskRecord;
  onToggle: () => void;
  onRunNow: () => void;
  onDelete: () => void;
  isRunning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55",
          task.enabled ? "text-primary" : "text-muted-foreground/40",
        )}>
          <Clock className="size-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{task.label}</div>
          <div className="truncate text-2xs text-muted-foreground/70">
            {TASK_TYPE_LABELS[task.taskType]} · <span className="font-mono">{task.cronExpression}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {task.lastRunStatus === "error" && <AlertTriangle className="size-3.5 text-status-red" />}
          {task.lastRunStatus === "success" && <Check className="size-3.5 text-status-green" />}
          <ChevronDown className={cn("size-4 text-muted-foreground/50 transition-transform", expanded && "rotate-180")} />
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-glass-border/50 px-4 py-3">
          {/* Info rows */}
          <div className="mb-3 divide-y divide-glass-border/40">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-2xs text-muted-foreground">Last run</span>
              <span className={cn("text-2xs font-medium", task.lastRunStatus === "error" ? "text-status-red" : "text-foreground")}>
                {formatRelative(task.lastRunAt)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-2xs text-muted-foreground">Next run</span>
              <span className="text-2xs font-medium text-foreground">
                {task.nextRunAt ? formatRelative(task.nextRunAt, true) : "—"}
              </span>
            </div>
            {task.lastRunOutput && (
              <div className="py-1.5">
                <span className="text-2xs text-muted-foreground">Output</span>
                <div className={cn(
                  "mt-1 rounded-md border border-glass-border/50 bg-background/40 px-2.5 py-2 font-mono text-2xs break-all",
                  task.lastRunStatus === "error" ? "text-status-red" : "text-foreground/80",
                )}>
                  {task.lastRunOutput}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className={cn(
                "rounded-lg border border-glass-border px-2.5 py-1 text-2xs font-medium transition-colors",
                task.enabled ? "bg-status-green/10 text-status-green" : "bg-background/55 text-muted-foreground hover:text-foreground",
              )}
            >
              {task.enabled ? "Enabled" : "Disabled"}
            </button>
            <button
              type="button"
              onClick={onRunNow}
              disabled={isRunning}
              className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="size-3" />
              {isRunning ? "Running…" : "Run now"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-2xs text-muted-foreground/50 transition-colors hover:bg-status-red/10 hover:text-status-red"
            >
              <Trash2 className="size-3" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create form ──────────────────────────────────────────────────────────────

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
  const patch = (u: Partial<TaskFormState>) => setForm((f) => ({ ...f, ...u }));
  const cronExpression = buildCron(form);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) return;
    if (form.taskType === "script" && !form.script.trim()) return;
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
      <div className="text-sm font-semibold text-foreground">New Task</div>

      <Field label="Label">
        <input
          required
          value={form.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="e.g. Clean Docker images"
          className={inputCls}
        />
      </Field>

      <Field label="Type">
        <select
          value={form.taskType}
          onChange={(e) => patch({ taskType: e.target.value as ScheduledTaskType })}
          className={selectCls}
        >
          {(Object.keys(TASK_TYPE_LABELS) as ScheduledTaskType[]).map((t) => (
            <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </Field>

      {form.taskType === "shell" && (
        <Field label="Command">
          <select
            value={form.shellCommand}
            onChange={(e) => patch({ shellCommand: e.target.value })}
            className={cn(selectCls, "font-mono")}
          >
            {SHELL_COMMAND_ALLOWLIST.map((cmd) => (
              <option key={cmd} value={cmd}>{cmd}</option>
            ))}
          </select>
        </Field>
      )}

      {form.taskType === "script" && (
        <Field label="Bash script">
          <textarea
            required
            rows={5}
            value={form.script}
            onChange={(e) => patch({ script: e.target.value })}
            placeholder={"#!/bin/bash\n# your commands here"}
            spellCheck={false}
            className="w-full resize-y rounded-lg border border-glass-border bg-background/55 px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary/40 focus:outline-none"
          />
          <p className="text-2xs text-muted-foreground/60">
            Runs via <code className="font-mono">bash -c</code> · 2-minute timeout
          </p>
        </Field>
      )}

      {form.taskType === "restart-app" && (
        <Field label="App">
          <select
            value={form.appId}
            onChange={(e) => {
              const app = installedApps.find((a) => a.id === e.target.value);
              patch({ appId: e.target.value, appName: app?.name ?? "" });
            }}
            className={selectCls}
          >
            <option value="">Select app…</option>
            {installedApps.map((app) => (
              <option key={app.id} value={app.id}>{app.name}</option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Schedule">
        <select
          value={form.cronPreset}
          onChange={(e) => patch({ cronPreset: e.target.value })}
          className={selectCls}
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
            className={cn(inputCls, "font-mono mt-1.5")}
          />
        )}
        <span className="font-mono text-2xs text-muted-foreground/60">{cronExpression}</span>
      </Field>

      <div className="flex items-center justify-end gap-2 border-t border-glass-border/50 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create task"}
        </button>
      </div>
    </form>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

export function ScheduledTasksSection() {
  const { tasks, createTask, updateTask, deleteTask, runNow } = useScheduledTasks();
  const [showForm, setShowForm] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  async function handleRunNow(id: string) {
    setRunningId(id);
    try { await runNow(id); } finally { setRunningId(null); }
  }

  async function handleCreate(input: CreateScheduledTaskInput) {
    await createTask(input);
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Tasks" />

      {tasks.length === 0 && !showForm && (
        <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-6 text-center text-xs text-muted-foreground")}>
          No scheduled tasks yet.
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            isRunning={runningId === task.id}
            onToggle={() => void updateTask(task.id, { enabled: !task.enabled })}
            onRunNow={() => void handleRunNow(task.id)}
            onDelete={() => void deleteTask(task.id)}
          />
        ))}

        {showForm && (
          <CreateTaskForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} />
        )}
      </div>

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-1 flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-muted-foreground/60 transition-colors hover:text-foreground/80"
        >
          <Plus className="size-3.5" />
          Add task
        </button>
      )}
    </div>
  );
}
