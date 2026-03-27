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
  BackupRow,
  InfoBanner,
  SectionDivider,
  SettingsInput,
  SettingsSelect,
  Toggle,
  formatStorageSize,
} from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import {
  DAY_OF_WEEK_OPTIONS,
  type BackupSettingsDraft,
  type SettingsBackend,
} from "@/modules/settings/components/panel/types";
import { Download, Upload } from "@/components/icons/platform-icons";
import { useEffect, useState } from "react";

type BackupSectionProps = {
  data: SettingsBackend["backup"];
  capabilities: SettingsBackend["capabilities"]["backup"];
  settingsDraft: BackupSettingsDraft;
  onSettingsChange: (patch: Partial<BackupSettingsDraft>) => void;
  onRunBackupNow: () => Promise<void>;
  onRestoreBackup: (backupId: string) => Promise<void>;
};

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
    data.backups.find((backup) => backup.id === restoreBackupId) ??
    data.backups[0] ??
    null;

  return (
    <div className="flex flex-col gap-1">
      {data.settings.error ? (
        <InfoBanner text={data.settings.error} variant="warning" />
      ) : null}
      {data.runNow.error ? (
        <InfoBanner text={data.runNow.error} variant="warning" />
      ) : null}
      {data.restore.error ? (
        <InfoBanner text={data.restore.error} variant="warning" />
      ) : null}

      <SectionDivider title="Backup Schedule" />
      <Toggle
        label="Automatic backups"
        description="Run full local backups of Homeio-managed data on the schedule below."
        enabled={settingsDraft.enabled}
        onToggle={() => onSettingsChange({ enabled: !settingsDraft.enabled })}
        disabled={capabilities.schedule.disabled}
        disabledReason={capabilities.schedule.disabledReason}
      />
      <SettingsSelect
        label="Frequency"
        value={settingsDraft.frequency}
        options={["daily", "weekly"]}
        onChange={(value) =>
          onSettingsChange({ frequency: value as "daily" | "weekly" })
        }
      />
      {settingsDraft.frequency === "weekly" ? (
        <SettingsSelect
          label="Day of week"
          value={settingsDraft.dayOfWeek}
          options={DAY_OF_WEEK_OPTIONS}
          onChange={(value) =>
            onSettingsChange({
              dayOfWeek: value as BackupSettingsDraft["dayOfWeek"],
            })
          }
        />
      ) : null}
      <SettingsInput
        label="Time"
        value={settingsDraft.time}
        description="24-hour format. Example: 03:00"
        onChange={(value) => onSettingsChange({ time: value })}
      />
      <SettingsInput
        label="Retention count"
        value={settingsDraft.retentionCount}
        description="Number of completed backups to keep in /DATA/Backups/homeio."
        onChange={(value) => onSettingsChange({ retentionCount: value })}
      />
      <SettingsInput
        label="Local path"
        value={data.backupRoot}
        description="Backups are stored locally only in this pass."
        readOnly
      />

      <SectionDivider title="Recent Backups" />
      {data.backups.length === 0 ? (
        <div className={`${SETTINGS_PANEL_INSET} px-3 py-3 text-xs text-muted-foreground`}>
          No completed backups yet. Run a manual backup to create the first
          archive.
        </div>
      ) : (
        <div className={`${SETTINGS_PANEL_INSET} overflow-hidden`}>
          {data.backups.map((backup, index) => (
            <div
              key={backup.id}
              className={
                index < data.backups.length - 1
                  ? "border-b border-glass-border px-3"
                  : "px-3"
              }
            >
              <BackupRow
                date={new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(backup.createdAt))}
                size={formatStorageSize(backup.sizeBytes)}
                type={`Full Backup • ${backup.hostname}`}
                status={backup.status}
                actionLabel="Select"
                actionDisabled={data.restore.isPending}
                onAction={() => {
                  setRestoreBackupId(backup.id);
                }}
              />
            </div>
          ))}
        </div>
      )}

      {selectedBackup ? (
        <div className="rounded-xl border border-status-amber/25 bg-status-amber/10 px-3 py-3 text-xs text-status-amber">
          Selected restore target:{" "}
          <span className="font-medium">{selectedBackup.id}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => {
            void onRunBackupNow();
          }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-primary/25 flex items-center gap-1.5"
          disabled={capabilities.runNow.disabled || data.runNow.isPending}
          title={capabilities.runNow.disabledReason}
        >
          <Upload className="size-3" />
          {data.runNow.isPending ? "Running Backup..." : "Run Backup Now"}
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary flex items-center gap-1.5"
              disabled={
                capabilities.restore.disabled ||
                !selectedBackup ||
                data.restore.isPending
              }
              title={capabilities.restore.disabledReason}
            >
              <Download className="size-3" />
              {data.restore.isPending
                ? "Starting Restore..."
                : "Restore from Backup"}
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
                onClick={(event) => {
                  event.preventDefault();
                  if (!selectedBackup) return;
                  void onRestoreBackup(selectedBackup.id);
                }}
                disabled={!selectedBackup || data.restore.isPending}
              >
                {data.restore.isPending
                  ? "Starting Restore..."
                  : "Restore Backup"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
