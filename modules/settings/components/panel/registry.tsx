import { SETTINGS_SECTIONS } from "@/modules/settings/components/panel/catalog";
import {
  AdvancedSection,
  AppearanceSection,
  BackupSection,
  DockerSection,
  GeneralSection,
  IntegrationsSection,
  NetworkSection,
  NotificationsSection,
  PowerSection,
  ScheduledTasksSection,
  SecuritySection,
  StorageSection,
  UpdatesSection,
  UsersSection,
} from "@/modules/settings/components/panel/sections";
import type {
  DesktopPreferencesApi,
  SettingsBackend,
  SettingsSection,
  SettingsSectionDefinition,
  SettingsSectionId,
} from "@/modules/settings/components/panel/types";

type SettingsRegistryContext = {
  appearance: Parameters<typeof AppearanceSection>[0]["appearance"];
  wallpaperOptions: Parameters<typeof AppearanceSection>[0]["wallpaperOptions"];
  accentOptions: Parameters<typeof AppearanceSection>[0]["accentOptions"];
  onAppearanceChange: Parameters<typeof AppearanceSection>[0]["onAppearanceChange"];
  wallpaperAccentColor: Parameters<typeof AppearanceSection>[0]["wallpaperAccentColor"];
  desktopPreferences: DesktopPreferencesApi;
  settingsBackend: SettingsBackend;
  onOpenDiskManager?: () => void;
  generalController: {
    draft: { hostname: string; timezone: string };
    setHostname: (value: string) => void;
    setTimezone: (value: string) => void;
    saveState: SettingsSectionDefinition["save"];
    save: () => Promise<void>;
  };
  securityController: {
    draft: Parameters<typeof SecuritySection>[0]["draft"];
    patchDraft: (patch: Partial<Parameters<typeof SecuritySection>[0]["draft"]>) => void;
    saveState: SettingsSectionDefinition["save"];
    save: () => Promise<void>;
  };
  notificationController: {
    draft: Parameters<typeof NotificationsSection>[0]["draft"];
    patchDraft: (patch: Partial<Parameters<typeof NotificationsSection>[0]["draft"]>) => void;
    saveState: SettingsSectionDefinition["save"];
    save: () => Promise<void>;
  };
  backupController: {
    draft: Parameters<typeof BackupSection>[0]["settingsDraft"];
    patchDraft: (patch: Partial<Parameters<typeof BackupSection>[0]["settingsDraft"]>) => void;
    saveState: SettingsSectionDefinition["save"];
    save: () => Promise<void>;
  };
};

/** What a section contributes on top of its catalog metadata. */
type SettingsSectionBody = Omit<SettingsSectionDefinition, keyof SettingsSection>;

function getDefaultSaveConfig(
  settingsBackend: SettingsBackend,
  sectionId: keyof SettingsBackend["capabilities"]["saveBySection"],
) {
  const visible = settingsBackend.capabilities.saveBySection[sectionId] ?? false;
  if (!visible) return undefined;

  return {
    canSave: false,
    title: settingsBackend.capabilities.saveDisabledReason,
    pending: false,
    label: "Save Changes",
    onSave: undefined,
  };
}

/**
 * Renderers keyed by section id. Typing this as a full `Record` means a section
 * added to the catalog will not compile until it is given a body here — the two
 * lists cannot drift apart.
 */
function buildSectionBodies(
  context: SettingsRegistryContext,
): Record<SettingsSectionId, SettingsSectionBody> {
  return {
    general: {
      render: () => (
        <GeneralSection
          data={context.settingsBackend.general}
          preferences={{
            ...context.settingsBackend.generalPreferences,
            hostname: context.generalController.draft.hostname,
            timezone: context.generalController.draft.timezone,
          }}
          capabilities={context.settingsBackend.capabilities.general}
          languageValue={context.desktopPreferences.languageLabel}
          languageOptions={context.desktopPreferences.languageOptions.map((o) => o.label)}
          onHostnameChange={context.generalController.setHostname}
          onTimezoneChange={context.generalController.setTimezone}
          onLanguageChange={(value) => {
            const next = context.desktopPreferences.languageOptions.find((o) => o.label === value);
            if (!next) return;
            context.desktopPreferences.setLanguage(next.code);
          }}
        />
      ),
      save: context.generalController.saveState
        ? { ...context.generalController.saveState, onSave: context.generalController.save }
        : getDefaultSaveConfig(context.settingsBackend, "general"),
    },

    appearance: {
      liveApply: true,
      render: () => (
        <AppearanceSection
          appearance={context.appearance}
          wallpaperOptions={context.wallpaperOptions}
          accentOptions={context.accentOptions}
          onAppearanceChange={context.onAppearanceChange}
          wallpaperAccentColor={context.wallpaperAccentColor}
        />
      ),
    },

    updates: {
      render: () => (
        <UpdatesSection
          data={context.settingsBackend.updates}
          capabilities={context.settingsBackend.capabilities.updates}
          onCheckForUpdates={context.settingsBackend.actions.checkForUpdates}
          onApplyUpdate={context.settingsBackend.actions.applySystemUpdate}
          autoCheckEnabled={context.desktopPreferences.preferences.autoCheckUpdates}
          onToggleAutoCheck={(enabled) => context.desktopPreferences.setAutoCheckUpdates(enabled)}
        />
      ),
      save: getDefaultSaveConfig(context.settingsBackend, "updates"),
    },

    network: {
      render: () => <NetworkSection data={context.settingsBackend.network} />,
      save: getDefaultSaveConfig(context.settingsBackend, "network"),
    },

    storage: {
      render: () => (
        <StorageSection
          data={context.settingsBackend.storage}
          onOpenDiskManager={context.onOpenDiskManager}
        />
      ),
      save: getDefaultSaveConfig(context.settingsBackend, "storage"),
    },

    docker: {
      render: () => (
        <DockerSection
          data={context.settingsBackend.docker}
          capabilities={context.settingsBackend.capabilities.docker}
          onPruneImages={context.settingsBackend.actions.pruneDockerImages}
          onPruneVolumes={context.settingsBackend.actions.pruneDockerVolumes}
        />
      ),
      save: getDefaultSaveConfig(context.settingsBackend, "docker"),
    },

    integrations: {
      render: () => <IntegrationsSection />,
    },

    "scheduled-tasks": {
      render: () => <ScheduledTasksSection />,
    },

    backup: {
      render: () => (
        <BackupSection
          data={context.settingsBackend.backup}
          capabilities={context.settingsBackend.capabilities.backup}
          settingsDraft={context.backupController.draft}
          onSettingsChange={context.backupController.patchDraft}
          onRunBackupNow={context.settingsBackend.actions.runBackupNow}
          onRestoreBackup={context.settingsBackend.actions.restoreBackup}
        />
      ),
      save: context.backupController.saveState
        ? { ...context.backupController.saveState, onSave: context.backupController.save }
        : getDefaultSaveConfig(context.settingsBackend, "backup"),
    },

    users: {
      render: () => (
        <UsersSection
          username={context.settingsBackend.general.username}
          twoFactor={context.settingsBackend.general.twoFactor}
          isDemoMode={context.settingsBackend.general.isDemoMode}
        />
      ),
      save: getDefaultSaveConfig(context.settingsBackend, "users"),
    },

    security: {
      render: () => (
        <SecuritySection
          data={context.settingsBackend.security}
          draft={context.securityController.draft}
          onChange={context.securityController.patchDraft}
        />
      ),
      save: context.securityController.saveState
        ? { ...context.securityController.saveState, onSave: context.securityController.save }
        : getDefaultSaveConfig(context.settingsBackend, "security"),
    },

    notifications: {
      render: () => (
        <NotificationsSection
          draft={context.notificationController.draft}
          onChange={context.notificationController.patchDraft}
          isDemoMode={context.settingsBackend.general.isDemoMode}
        />
      ),
      save: context.notificationController.saveState
        ? { ...context.notificationController.saveState, onSave: context.notificationController.save }
        : getDefaultSaveConfig(context.settingsBackend, "notifications"),
    },

    power: {
      render: () => (
        <PowerSection
          power={context.settingsBackend.power}
          onRebootNow={context.settingsBackend.actions.rebootNow}
          onShutdownNow={context.settingsBackend.actions.shutdownNow}
          onSaveScheduledReboot={context.settingsBackend.actions.saveScheduledReboot}
          onFactoryReset={context.settingsBackend.actions.factoryReset}
        />
      ),
      save: getDefaultSaveConfig(context.settingsBackend, "power"),
    },

    advanced: {
      render: () => <AdvancedSection />,
    },
  };
}

export function buildSettingsSectionDefinitions(
  context: SettingsRegistryContext,
): SettingsSectionDefinition[] {
  const bodies = buildSectionBodies(context);
  return SETTINGS_SECTIONS.map((section) => ({
    ...section,
    ...bodies[section.id],
  }));
}
