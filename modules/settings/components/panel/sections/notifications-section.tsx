import {
  SectionDivider,
  SettingsInput,
  Toggle,
} from "@/modules/settings/components/panel/controls";
import type { NotificationSettingsDraft } from "@/modules/settings/components/panel/types";

type NotificationsSectionProps = {
  draft: NotificationSettingsDraft;
  onChange: (patch: Partial<NotificationSettingsDraft>) => void;
};

export function NotificationsSection({
  draft,
  onChange,
}: NotificationsSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Alert Types" />
      <Toggle
        label="System alerts"
        description="CPU overload, high temperature, low disk space"
        enabled={draft.systemAlertsEnabled}
        onToggle={() =>
          onChange({ systemAlertsEnabled: !draft.systemAlertsEnabled })
        }
      />
      <Toggle
        label="Update notifications"
        description="Homeio update availability in the desktop alert center"
        enabled={draft.updateNotificationsEnabled}
        onToggle={() =>
          onChange({
            updateNotificationsEnabled: !draft.updateNotificationsEnabled,
          })
        }
      />
      <Toggle
        label="Backup reports"
        description="Backup success/failure notifications"
        enabled={draft.backupReportsEnabled}
        onToggle={() =>
          onChange({ backupReportsEnabled: !draft.backupReportsEnabled })
        }
      />
      <Toggle
        label="Security events"
        description="Failed logins, firewall blocks, certificate expiry"
        enabled={draft.securityEventsEnabled}
        onToggle={() => undefined}
        disabled
        disabledReason="Soon"
      />

      <SectionDivider title="Thresholds" />
      <SettingsInput
        label="CPU usage alert threshold"
        value={draft.cpuAlertThresholdPercent}
        description="Trigger alert when CPU usage exceeds this %"
        onChange={(value) => onChange({ cpuAlertThresholdPercent: value })}
      />
      <SettingsInput
        label="Memory alert threshold"
        value={draft.memoryAlertThresholdPercent}
        description="Trigger alert when RAM usage exceeds this %"
        onChange={(value) => onChange({ memoryAlertThresholdPercent: value })}
      />
      <SettingsInput
        label="Disk space alert threshold"
        value={draft.diskAlertThresholdPercent}
        description="Trigger alert when disk usage exceeds this %"
        onChange={(value) => onChange({ diskAlertThresholdPercent: value })}
      />
      <SettingsInput
        label="Temperature alert threshold"
        value={draft.temperatureAlertThresholdCelsius}
        description="Trigger alert when CPU temp exceeds this (Celsius)"
        onChange={(value) =>
          onChange({ temperatureAlertThresholdCelsius: value })
        }
      />
    </div>
  );
}
