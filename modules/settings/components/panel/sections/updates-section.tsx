import {
    ControlDisabledHint,
    InfoBanner,
    SectionDivider,
    Toggle,
} from "@/modules/settings/components/panel/controls";
import {
  SETTINGS_BADGE_SURFACE,
  SETTINGS_PANEL_INSET,
  SETTINGS_PANEL_SHELL,
} from "@/modules/settings/components/panel/surface";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";
import { RefreshCw } from "@/components/icons/platform-icons";

type UpdatesSectionProps = {
  data: SettingsBackend["updates"];
  capabilities: SettingsBackend["capabilities"]["updates"];
  onCheckForUpdates: () => void;
  onApplyUpdate: () => void;
  autoCheckEnabled: boolean;
  onToggleAutoCheck: (enabled: boolean) => void;
};

export function UpdatesSection({
  data,
  capabilities,
  onCheckForUpdates,
  onApplyUpdate,
  autoCheckEnabled,
  onToggleAutoCheck,
}: UpdatesSectionProps) {
  const statusLabel = data.updateAvailable
    ? "Update available"
    : data.latestVersion
      ? "Up to date"
      : "Unable to determine";
  const lastCheckedLabel = data.checkedAt
    ? new Date(data.checkedAt).toLocaleString()
    : "Not checked yet";
  const inlineStatusText = data.isRecoveryActive
    ? "Homeio update in progress. This page will reconnect automatically."
    : data.isChecking
      ? "Checking Homeio updates..."
      : data.updateAvailable && data.latestVersion
        ? `Update available: Homeio ${data.latestVersion}`
        : data.checkedAt
          ? "Last check: Homeio is up to date"
          : "No update check has run yet";

  return (
    <div className="flex flex-col gap-1">
      {data.warning ? (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      ) : null}
      {data.checkError ? (
        <InfoBanner text={data.checkError} variant="warning" />
      ) : null}
      {data.applyError ? (
        <InfoBanner text={data.applyError} variant="warning" />
      ) : null}
      {data.isRecoveryActive ? (
        <InfoBanner
          text="Homeio is restarting to finish the update. This page will reconnect automatically."
          variant="info"
        />
      ) : null}
      <SectionDivider title="Updates" />
      <div className={`${SETTINGS_PANEL_SHELL} px-3 py-3`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Application
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              Homeio
            </div>
          </div>
          <div
            className={`${SETTINGS_BADGE_SURFACE} px-2.5 py-1 text-2xs font-medium ${
              data.updateAvailable
                ? "bg-status-amber/15 text-status-amber"
                : "bg-primary/12 text-primary"
            }`}
          >
            {statusLabel}
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className={`${SETTINGS_PANEL_INSET} px-3 py-2`}>
            <div className="text-2xs uppercase tracking-[0.16em] text-muted-foreground">
              Current
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {data.currentVersion}
            </div>
          </div>
          <div className={`${SETTINGS_PANEL_INSET} px-3 py-2`}>
            <div className="text-2xs uppercase tracking-[0.16em] text-muted-foreground">
              Latest
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {data.latestVersion ?? "Unavailable"}
            </div>
          </div>
          <div className={`${SETTINGS_PANEL_INSET} px-3 py-2`}>
            <div className="text-2xs uppercase tracking-[0.16em] text-muted-foreground">
              Last Checked
            </div>
            <div className="mt-1 text-sm font-medium text-foreground">
              {lastCheckedLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-primary/25"
          disabled={
            capabilities.updateHomeio.disabled ||
            !data.updateAvailable ||
            data.isApplying ||
            data.isRecoveryActive
          }
          title={capabilities.updateHomeio.disabledReason}
          onClick={onApplyUpdate}
        >
          {data.isApplying || data.isRecoveryActive
            ? "Updating..."
            : "Update Homeio"}
        </button>
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary"
          disabled={
            capabilities.checkForUpdates.disabled ||
            data.isChecking ||
            data.isRecoveryActive
          }
          onClick={onCheckForUpdates}
        >
          <RefreshCw className="size-3" />
          {data.isChecking ? "Checking..." : "Check for Updates"}
        </button>
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground/90">
          {inlineStatusText}
        </span>
        {data.checkedAt && !data.isRecoveryActive ? (
          <span className="text-muted-foreground"> • {lastCheckedLabel}</span>
        ) : null}
      </div>
      <ControlDisabledHint text={capabilities.updateHomeio.disabledReason} />

      <SectionDivider title="Update Preferences" />
      <Toggle
        label="Auto-check for updates"
        description="Check for new updates daily"
        enabled={autoCheckEnabled}
        onToggle={() => onToggleAutoCheck(!autoCheckEnabled)}
        disabled={capabilities.autoCheck.disabled}
        disabledReason={capabilities.autoCheck.disabledReason}
      />
    </div>
  );
}
