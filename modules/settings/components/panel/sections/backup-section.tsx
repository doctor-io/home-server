"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  InfoBanner,
  SectionDivider,
  Toggle,
  formatStorageSize,
} from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import {
  DAY_OF_WEEK_OPTIONS,
  SCHEDULE_TIME_OPTIONS,
  type BackupSettingsDraft,
  type SettingsBackend,
} from "@/modules/settings/components/panel/types";
import { Download, Upload } from "@/components/icons/platform-icons";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type BackupSectionProps = {
  data: SettingsBackend["backup"];
  capabilities: SettingsBackend["capabilities"]["backup"];
  settingsDraft: BackupSettingsDraft;
  onSettingsChange: (patch: Partial<BackupSettingsDraft>) => void;
  onRunBackupNow: () => Promise<void>;
  onRestoreBackup: (backupId: string) => Promise<void>;
};

const selectCls = "h-8 w-full cursor-pointer appearance-none rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-foreground focus:border-primary/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between gap-4 px-4 py-3")}>
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        {description && (
          <div className="mt-0.5 text-[11px] text-muted-foreground/70">{description}</div>
        )}
      </div>
      {children}
    </div>
  );
}

export function BackupSection({
  data,
  capabilities,
  settingsDraft,
  onSettingsChange,
  onRunBackupNow,
  onRestoreBackup,
}: BackupSectionProps) {
  const [restoreBackupId, setRestoreBackupId] = useState<string | null>(null);

  useEffect(() => {
    if (!restoreBackupId && data.backups[0]) {
      setRestoreBackupId(data.backups[0].id);
    }
  }, [data.backups, restoreBackupId]);

  const selectedBackup =
    data.backups.find((b) => b.id === restoreBackupId) ?? data.backups[0] ?? null;

  return (
    <div className="flex flex-col gap-1">
      {data.settings.error && <InfoBanner text={data.settings.error} variant="warning" />}
      {data.runNow.error && <InfoBanner text={data.runNow.error} variant="warning" />}
      {data.restore.error && <InfoBanner text={data.restore.error} variant="warning" />}

      {/* ── Schedule ── */}
      <SectionDivider title="Schedule" />
      <div className="flex flex-col gap-1.5">
        <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-1")}>
          <Toggle
            label="Automatic backups"
            description="Run full local backups of Homeio-managed data on the schedule below."
            enabled={settingsDraft.enabled}
            onToggle={() => onSettingsChange({ enabled: !settingsDraft.enabled })}
            disabled={capabilities.schedule.disabled}
            disabledReason={capabilities.schedule.disabledReason}
          />
        </div>

        <PreferenceRow label="Frequency">
          <select
            value={settingsDraft.frequency}
            onChange={(e) => onSettingsChange({ frequency: e.target.value as "daily" | "weekly" })}
            className={cn(selectCls, "w-36")}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </PreferenceRow>

        {settingsDraft.frequency === "weekly" && (
          <PreferenceRow label="Day of week">
            <select
              value={settingsDraft.dayOfWeek}
              onChange={(e) => onSettingsChange({ dayOfWeek: e.target.value as BackupSettingsDraft["dayOfWeek"] })}
              className={cn(selectCls, "w-36")}
            >
              {DAY_OF_WEEK_OPTIONS.map((d) => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </PreferenceRow>
        )}

        <PreferenceRow label="Time" description="24-hour format">
          <select
            value={settingsDraft.time}
            onChange={(e) => onSettingsChange({ time: e.target.value })}
            className={cn(selectCls, "w-36 font-mono")}
          >
            {SCHEDULE_TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </PreferenceRow>

        <PreferenceRow label="Retention" description="Backups to keep in /DATA/Backups/homeio">
          <input
            value={settingsDraft.retentionCount}
            onChange={(e) => onSettingsChange({ retentionCount: e.target.value })}
            type="number"
            min={1}
            className="h-8 w-36 rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-foreground focus:border-primary/40 focus:outline-none"
          />
        </PreferenceRow>

        <PreferenceRow label="Local path" description="Backups are stored locally only">
          <span className="font-mono text-xs text-muted-foreground">{data.backupRoot}</span>
        </PreferenceRow>
      </div>

      {/* ── Actions ── */}
      <SectionDivider title="Backup & Restore" />
      <div className="flex flex-col gap-1.5">
        <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between gap-4 px-4 py-3")}>
          <div className="min-w-0">
            <div className="text-sm text-foreground">Run backup now</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/70">Creates a full archive immediately</div>
          </div>
          <button
            onClick={() => void onRunBackupNow()}
            disabled={capabilities.runNow.disabled || data.runNow.isPending}
            title={capabilities.runNow.disabledReason}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="size-3" />
            {data.runNow.isPending ? "Running…" : "Run now"}
          </button>
        </div>

        <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between gap-4 px-4 py-3")}>
          <div className="min-w-0">
            <div className="text-sm text-foreground">Restore from backup</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground/70">
              {selectedBackup
                ? `Selected: ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(selectedBackup.createdAt))}`
                : "No backup selected"}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                disabled={capabilities.restore.disabled || !selectedBackup || data.restore.isPending}
                title={capabilities.restore.disabledReason}
                className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download className="size-3" />
                {data.restore.isPending ? "Restoring…" : "Restore"}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restore full system backup?</AlertDialogTitle>
                <AlertDialogDescription>
                  {selectedBackup
                    ? `This will fully replace the current database and /DATA contents with ${selectedBackup.id}, then reboot the server.`
                    : "Select a backup first."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    if (!selectedBackup) return;
                    void onRestoreBackup(selectedBackup.id);
                  }}
                  disabled={!selectedBackup || data.restore.isPending}
                >
                  {data.restore.isPending ? "Restoring…" : "Restore Backup"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Recent Backups ── */}
      <SectionDivider title="Recent Backups" />
      {data.backups.length === 0 ? (
        <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-3 text-xs text-muted-foreground")}>
          No completed backups yet.
        </div>
      ) : (
        <div className={cn(SETTINGS_PANEL_INSET, "divide-y divide-glass-border/50 overflow-hidden")}>
          {data.backups.map((backup) => {
            const isSelected = selectedBackup?.id === backup.id;
            return (
              <button
                key={backup.id}
                type="button"
                onClick={() => setRestoreBackupId(backup.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  isSelected ? "bg-primary/8" : "hover:bg-background/40",
                )}
              >
                <div className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  backup.status === "completed" ? "bg-status-green" : "bg-status-red",
                )} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(backup.createdAt))}
                  </div>
                  <div className="text-[11px] text-muted-foreground/70">
                    {backup.hostname} · {formatStorageSize(backup.sizeBytes)}
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[11px] font-medium text-primary">Selected</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
