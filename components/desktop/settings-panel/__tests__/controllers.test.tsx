/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useBackupSettingsController,
  useGeneralSettingsController,
  useNotificationSettingsController,
} from "@/modules/settings/components/panel/controllers";
import type {
  DesktopPreferencesApi,
  SettingsBackend,
} from "@/modules/settings/components/panel/types";

function createGeneralPreferences(
  overrides: Partial<SettingsBackend["generalPreferences"]> = {},
) {
  return {
    hostname: "home-node",
    timezone: "UTC",
    timezoneOptions: ["UTC", "Europe/Paris"],
    isLoading: false,
    isSaving: false,
    error: null,
    ...overrides,
  } as SettingsBackend["generalPreferences"];
}

function createBackupSettings(
  overrides: Partial<SettingsBackend["backup"]["settings"]> = {},
) {
  return {
    enabled: false,
    frequency: "weekly",
    dayOfWeek: "sunday",
    time: "03:00",
    retentionCount: 7,
    isLoading: false,
    isSaving: false,
    error: null,
    ...overrides,
  } as SettingsBackend["backup"]["settings"];
}

function createDesktopPreferencesApi(
  overrides: Partial<DesktopPreferencesApi> = {},
) {
  const setNotificationPreferences = vi.fn();

  return {
    preferences: {
      language: "en-US",
      autoCheckUpdates: true,
      notifications: {
        systemAlertsEnabled: true,
        updateNotificationsEnabled: true,
        backupReportsEnabled: true,
        securityEventsEnabled: false,
        cpuAlertThresholdPercent: 85,
        memoryAlertThresholdPercent: 85,
        diskAlertThresholdPercent: 90,
        temperatureAlertThresholdCelsius: 80,
      },
    },
    isHydrated: true,
    languageLabel: "English (US)",
    languageOptions: [{ code: "en-US", label: "English (US)" }],
    setLanguage: vi.fn(),
    setAutoCheckUpdates: vi.fn(),
    notificationPreferences: {
      systemAlertsEnabled: true,
      updateNotificationsEnabled: true,
      backupReportsEnabled: true,
      securityEventsEnabled: false,
      cpuAlertThresholdPercent: 85,
      memoryAlertThresholdPercent: 85,
      diskAlertThresholdPercent: 90,
      temperatureAlertThresholdCelsius: 80,
    },
    setSystemAlertsEnabled: vi.fn(),
    setUpdateNotificationsEnabled: vi.fn(),
    setBackupReportsEnabled: vi.fn(),
    setSecurityEventsEnabled: vi.fn(),
    setCpuAlertThresholdPercent: vi.fn(),
    setMemoryAlertThresholdPercent: vi.fn(),
    setDiskAlertThresholdPercent: vi.fn(),
    setTemperatureAlertThresholdCelsius: vi.fn(),
    setNotificationPreferences,
    ...overrides,
  } as DesktopPreferencesApi;
}

describe("settings-panel controllers", () => {
  it("hydrates general preferences and saves a normalized hostname", async () => {
    const saveGeneralPreferences = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ preferences }) =>
        useGeneralSettingsController(preferences, saveGeneralPreferences),
      {
        initialProps: {
          preferences: createGeneralPreferences(),
        },
      },
    );

    act(() => {
      result.current.setHostname("  Home-New  ");
    });

    expect(result.current.saveState.canSave).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    expect(saveGeneralPreferences).toHaveBeenCalledWith({
      hostname: "home-new",
      timezone: "UTC",
    });

    rerender({
      preferences: createGeneralPreferences({
        hostname: "server-two",
        timezone: "Europe/Paris",
      }),
    });

    expect(result.current.draft).toEqual({
      hostname: "server-two",
      timezone: "Europe/Paris",
    });
  });

  it("keeps backup save disabled when the draft is invalid", () => {
    const saveBackupSettings = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useBackupSettingsController(
        createBackupSettings(),
        saveBackupSettings,
      ),
    );

    act(() => {
      result.current.patchDraft({
        time: "3:00",
        retentionCount: "0",
      });
    });

    expect(result.current.saveState.canSave).toBe(false);
    expect(result.current.saveState.title).toBe("Backup time must use HH:MM");
  });

  it("persists notification drafts through desktop preferences", async () => {
    const desktopPreferences = createDesktopPreferencesApi();
    const { result } = renderHook(() =>
      useNotificationSettingsController(desktopPreferences),
    );

    act(() => {
      result.current.patchDraft({
        cpuAlertThresholdPercent: "70",
      });
    });

    expect(result.current.saveState.canSave).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    expect(desktopPreferences.setNotificationPreferences).toHaveBeenCalledTimes(
      1,
    );
    const setNotificationPreferences = desktopPreferences
      .setNotificationPreferences as ReturnType<typeof vi.fn>;
    const updater = setNotificationPreferences.mock.calls[0]?.[0] as (
      current: DesktopPreferencesApi["notificationPreferences"],
    ) => unknown;
    expect(
      updater(desktopPreferences.notificationPreferences),
    ).toMatchObject({
      cpuAlertThresholdPercent: 70,
    });
  });
});
