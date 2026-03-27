import {
  SYSTEM_SECURITY_BAN_DURATION_MAX,
  SYSTEM_SECURITY_BAN_DURATION_MIN,
  SYSTEM_SECURITY_MAX_RETRIES_MAX,
  SYSTEM_SECURITY_MAX_RETRIES_MIN,
} from "@/lib/shared/contracts/system";
import type {
  BackupSettingsDraft,
  GeneralPreferencesDraft,
  NotificationSettingsDraft,
  SecuritySettingsDraft,
  SettingsBackend,
} from "@/modules/settings/components/panel/types";

export function normalizeHostnameDraft(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\s+/g, "");
}

export function isValidHostname(hostname: string) {
  return /^[a-z0-9][a-z0-9.-]{0,62}$/.test(hostname || "homeio");
}

export function parseSecurityDraft(draft: SecuritySettingsDraft) {
  return {
    maxRetries: Number.parseInt(draft.fail2banMaxRetries, 10),
    banDuration: Number.parseInt(draft.fail2banBanDurationSeconds, 10),
  };
}

export function areSecurityNumbersValid(draft: SecuritySettingsDraft) {
  const { maxRetries, banDuration } = parseSecurityDraft(draft);

  return (
    Number.isInteger(maxRetries) &&
    maxRetries >= SYSTEM_SECURITY_MAX_RETRIES_MIN &&
    maxRetries <= SYSTEM_SECURITY_MAX_RETRIES_MAX &&
    Number.isInteger(banDuration) &&
    banDuration >= SYSTEM_SECURITY_BAN_DURATION_MIN &&
    banDuration <= SYSTEM_SECURITY_BAN_DURATION_MAX
  );
}

export function getGeneralSaveTitle(args: {
  draft: GeneralPreferencesDraft;
  data: SettingsBackend["generalPreferences"];
}) {
  const normalizedHostname = normalizeHostnameDraft(args.draft.hostname);
  if (!isValidHostname(normalizedHostname)) {
    return "Hostname is invalid";
  }

  if (args.data.isSaving) {
    return "Saving general preferences";
  }

  return undefined;
}

export function isBackupTimeValid(time: string) {
  return /^\d{2}:\d{2}$/.test(time);
}

export function parseBackupRetentionCount(draft: BackupSettingsDraft) {
  return Number.parseInt(draft.retentionCount, 10);
}

export function isBackupRetentionCountValid(retentionCount: number) {
  return (
    Number.isInteger(retentionCount) &&
    retentionCount >= 1 &&
    retentionCount <= 365
  );
}

export function getBackupSaveTitle(args: {
  draft: BackupSettingsDraft;
  data: SettingsBackend["backup"]["settings"];
}) {
  const retentionCount = parseBackupRetentionCount(args.draft);

  if (!isBackupTimeValid(args.draft.time)) {
    return "Backup time must use HH:MM";
  }

  if (!isBackupRetentionCountValid(retentionCount)) {
    return "Retention count must be between 1 and 365";
  }

  if (args.data.isSaving) {
    return "Saving backup settings";
  }

  return undefined;
}

export function parseNotificationThresholds(draft: NotificationSettingsDraft) {
  return {
    cpu: Number.parseInt(draft.cpuAlertThresholdPercent, 10),
    memory: Number.parseInt(draft.memoryAlertThresholdPercent, 10),
    disk: Number.parseInt(draft.diskAlertThresholdPercent, 10),
    temperature: Number.parseInt(draft.temperatureAlertThresholdCelsius, 10),
  };
}

export function areNotificationThresholdsValid(draft: NotificationSettingsDraft) {
  const thresholds = parseNotificationThresholds(draft);

  return (
    Number.isInteger(thresholds.cpu) &&
    thresholds.cpu >= 1 &&
    thresholds.cpu <= 100 &&
    Number.isInteger(thresholds.memory) &&
    thresholds.memory >= 1 &&
    thresholds.memory <= 100 &&
    Number.isInteger(thresholds.disk) &&
    thresholds.disk >= 1 &&
    thresholds.disk <= 100 &&
    Number.isInteger(thresholds.temperature) &&
    thresholds.temperature >= 1 &&
    thresholds.temperature <= 150
  );
}

export function getNotificationsSaveTitle(draft: NotificationSettingsDraft) {
  if (!areNotificationThresholdsValid(draft)) {
    return "Notification thresholds must use valid numeric ranges";
  }

  return undefined;
}

export function getSecuritySaveTitle(args: {
  draft: SecuritySettingsDraft;
  data: SettingsBackend["security"];
}) {
  const { maxRetries, banDuration } = parseSecurityDraft(args.draft);

  if (args.data.unavailable) {
    return args.data.error ?? "Security settings unavailable";
  }

  if (
    !Number.isInteger(maxRetries) ||
    maxRetries < SYSTEM_SECURITY_MAX_RETRIES_MIN ||
    maxRetries > SYSTEM_SECURITY_MAX_RETRIES_MAX
  ) {
    return `Max retries must be between ${SYSTEM_SECURITY_MAX_RETRIES_MIN} and ${SYSTEM_SECURITY_MAX_RETRIES_MAX}`;
  }

  if (
    !Number.isInteger(banDuration) ||
    banDuration < SYSTEM_SECURITY_BAN_DURATION_MIN ||
    banDuration > SYSTEM_SECURITY_BAN_DURATION_MAX
  ) {
    return `Ban duration must be between ${SYSTEM_SECURITY_BAN_DURATION_MIN} and ${SYSTEM_SECURITY_BAN_DURATION_MAX} seconds`;
  }

  if (args.data.isSaving) {
    return "Saving security settings";
  }

  return undefined;
}
