"use client";

import { useDesktopPreferences } from "@/hooks/useDesktopPreferences";
import {
  useActiveSettingsSection,
  useBackupSettingsController,
  useGeneralSettingsController,
  useNotificationSettingsController,
  useSecuritySettingsController,
  useUpdatesAutoCheckEffect,
} from "@/modules/settings/components/panel/controllers";
import {
  buildSettingsSectionDefinitions,
  SETTINGS_SECTIONS,
} from "@/modules/settings/components/panel/registry";
import {
  SETTINGS_BADGE_SURFACE,
  SETTINGS_PANEL_SHELL,
} from "@/modules/settings/components/panel/surface";
import type { SettingsPanelProps } from "@/modules/settings/components/panel/types";
import { useSettingsBackend } from "@/modules/settings/hooks/useSettingsBackend";

export function SettingsPanel({
  appearance,
  wallpaperOptions,
  accentOptions,
  onAppearanceChange,
  selectedSection,
}: SettingsPanelProps) {
  const settingsBackend = useSettingsBackend();
  const desktopPreferences = useDesktopPreferences();
  const { activeSection, setActiveSection } = useActiveSettingsSection(
    selectedSection,
    SETTINGS_SECTIONS.map((section) => section.id),
  );

  const generalController = useGeneralSettingsController(
    settingsBackend.generalPreferences,
    settingsBackend.actions.saveGeneralPreferences,
  );
  const securityController = useSecuritySettingsController(
    settingsBackend.security,
    settingsBackend.actions.saveSecuritySettings,
  );
  const backupController = useBackupSettingsController(
    settingsBackend.backup.settings,
    settingsBackend.actions.saveBackupSettings,
  );
  const notificationController =
    useNotificationSettingsController(desktopPreferences);

  useUpdatesAutoCheckEffect({
    activeSection,
    isHydrated: desktopPreferences.isHydrated,
    autoCheckEnabled: desktopPreferences.preferences.autoCheckUpdates,
    onCheckForUpdates: settingsBackend.actions.checkForUpdates,
  });

  const sectionDefinitions = buildSettingsSectionDefinitions({
    appearance,
    wallpaperOptions,
    accentOptions,
    onAppearanceChange,
    desktopPreferences,
    settingsBackend,
    generalController,
    securityController,
    notificationController,
    backupController,
  });
  const activeDefinition =
    sectionDefinitions.find((section) => section.id === activeSection) ??
    sectionDefinitions[0];

  return (
    <div className="flex h-full">
      <aside className={`m-2 flex w-52 shrink-0 flex-col overflow-y-auto ${SETTINGS_PANEL_SHELL}`}>
        <div className="p-3 pt-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2">
            Settings
          </span>
          <div className="flex flex-col gap-0.5 mt-2">
            {sectionDefinitions.map((section) => {
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <section.icon
                    className={`size-4 ${isActive ? "text-primary" : ""}`}
                  />
                  <span className="flex-1 text-left truncate">
                    {section.label}
                  </span>
                  {section.badge ? (
                    <span className={`${SETTINGS_BADGE_SURFACE} flex size-4.5 items-center justify-center text-xs font-bold text-primary`}>
                      {section.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto border-t border-glass-border/80 p-3">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-[var(--radius)] bg-status-green" />
            <span className="text-xs text-muted-foreground">
              {settingsBackend.general.hostname}
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            {settingsBackend.general.appVersion} |{" "}
            {settingsBackend.general.platform}
          </span>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {activeDefinition.label}
            </h2>
            {!activeDefinition.liveApply && activeDefinition.save ? (
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-primary/90"
                disabled={!activeDefinition.save.canSave}
                title={activeDefinition.save.title}
                onClick={() => {
                  void activeDefinition.save?.onSave?.();
                }}
              >
                {activeDefinition.save.pending
                  ? (activeDefinition.save.label ?? "Saving...")
                  : (activeDefinition.save.label ?? "Save Changes")}
              </button>
            ) : null}
          </div>
          {activeDefinition.render()}
        </div>
      </main>
    </div>
  );
}
