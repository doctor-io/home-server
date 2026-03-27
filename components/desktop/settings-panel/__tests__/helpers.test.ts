import { describe, expect, it } from "vitest";
import { formatStorageSize } from "@/modules/settings/components/panel/controls";
import {
  areNotificationThresholdsValid,
  areSecurityNumbersValid,
  isBackupRetentionCountValid,
  isBackupTimeValid,
  isValidHostname,
  normalizeHostnameDraft,
} from "@/modules/settings/components/panel/save-policies";

describe("settings-panel helpers", () => {
  it("formats storage sizes with KB, MB, GB, and TB boundaries", () => {
    expect(formatStorageSize(1024)).toBe("1 KB");
    expect(formatStorageSize(5 * 1024 ** 2)).toBe("5.0 MB");
    expect(formatStorageSize(3.5 * 1024 ** 3)).toBe("3.5 GB");
    expect(formatStorageSize(2 * 1024 ** 4)).toBe("2.0 TB");
    expect(formatStorageSize(null)).toBe("--");
  });

  it("normalizes and validates hostnames", () => {
    expect(normalizeHostnameDraft("  Home-Server  ")).toBe("home-server");
    expect(isValidHostname("home-server")).toBe(true);
    expect(isValidHostname("bad hostname")).toBe(false);
  });

  it("validates backup save policy primitives", () => {
    expect(isBackupTimeValid("03:00")).toBe(true);
    expect(isBackupTimeValid("3:00")).toBe(false);
    expect(isBackupRetentionCountValid(7)).toBe(true);
    expect(isBackupRetentionCountValid(0)).toBe(false);
  });

  it("validates security and notification numeric ranges", () => {
    expect(
      areSecurityNumbersValid({
        firewallEnabled: true,
        firewallIncomingPolicy: "deny",
        firewallOutgoingPolicy: "allow",
        fail2banEnabled: true,
        fail2banMaxRetries: "5",
        fail2banBanDurationSeconds: "3600",
      }),
    ).toBe(true);

    expect(
      areNotificationThresholdsValid({
        systemAlertsEnabled: true,
        updateNotificationsEnabled: true,
        backupReportsEnabled: true,
        securityEventsEnabled: false,
        cpuAlertThresholdPercent: "85",
        memoryAlertThresholdPercent: "85",
        diskAlertThresholdPercent: "90",
        temperatureAlertThresholdCelsius: "80",
      }),
    ).toBe(true);

    expect(
      areNotificationThresholdsValid({
        systemAlertsEnabled: true,
        updateNotificationsEnabled: true,
        backupReportsEnabled: true,
        securityEventsEnabled: false,
        cpuAlertThresholdPercent: "101",
        memoryAlertThresholdPercent: "85",
        diskAlertThresholdPercent: "90",
        temperatureAlertThresholdCelsius: "80",
      }),
    ).toBe(false);
  });
});
