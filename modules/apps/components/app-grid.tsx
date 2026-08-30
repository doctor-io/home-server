"use client";

import { AppGridContent } from "@/modules/apps/components/app-grid-content";
import { useAppGridController } from "@/modules/apps/components/app-grid-controller";
import { AppGridContextMenu } from "@/modules/apps/components/app-grid-menu";
import type { AppActionTarget } from "@/modules/apps/components/app-grid-presenters";
import { UninstallAppDialog } from "@/modules/apps/components/uninstall-app-dialog";
import { X } from "@/components/icons/platform-icons";
export type { AppActionTarget } from "@/modules/apps/components/app-grid-presenters";

type AppGridProps = {
  iconSize?: "small" | "medium" | "large";
  animationsEnabled?: boolean;
  onOpenDashboard?: (target: AppActionTarget) => void;
  onViewLogs?: (target: AppActionTarget) => void;
  onOpenTerminal?: (target: AppActionTarget) => void;
  onOpenSettings?: (target: AppActionTarget) => void;
  onCopyUrl?: (target: AppActionTarget) => void;
};

export function AppGrid({
  iconSize = "medium",
  animationsEnabled = true,
  onOpenDashboard,
  onViewLogs,
  onOpenTerminal,
  onOpenSettings,
  onCopyUrl,
}: AppGridProps) {
  const controller = useAppGridController({
    onCopyUrl,
    onOpenDashboard,
    onOpenSettings,
    onOpenTerminal,
    onViewLogs,
  });

  return (
    <section
      className="flex-1 px-6 pt-4 pb-6 overflow-y-auto"
      onClick={controller.closeContextMenu}
    >
      {controller.actionError ? (
        // This banner sits on the desktop, over the wallpaper: a 10%-opacity
        // tint left red text competing with a photo. An opaque backdrop plus
        // blur — the same treatment as system-error-capsule — keeps it legible
        // on any wallpaper, and the text is lightened for contrast against it.
        <div className="mt-4 flex items-start justify-between gap-2 rounded-lg border border-status-red/35 bg-black/55 px-3 py-2 text-xs text-[oklch(0.82_0.13_25)] shadow-[var(--system-shadow-surface)] backdrop-blur-xl">
          <span>{controller.actionError}</span>
          <button
            onClick={controller.dismissActionError}
            className="mt-0.5 shrink-0 opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
      <AppGridContent
        activeAppId={controller.activeAppId}
        activeOperationsCount={controller.activeOperationsCount}
        animationsEnabled={animationsEnabled}
        apps={controller.apps}
        iconSize={iconSize}
        isAppsError={controller.isAppsError}
        isAppsLoading={controller.isAppsLoading}
        onAppContextMenu={controller.openContextMenu}
        onOpenApp={(app) => {
          void controller.openDashboardForApp(app);
        }}
        primaryOperation={controller.primaryOperation}
      />

      {controller.contextMenu ? (
        <div
          className="fixed inset-0 z-[219]"
          onClick={controller.closeContextMenu}
        />
      ) : null}

      {controller.contextMenu && controller.menuApp ? (
        <AppGridContextMenu
          app={controller.menuApp}
          hasDashboardUrl={controller.menuHasDashboardUrl}
          isBusy={controller.isMenuAppBusy}
          x={controller.contextMenu.x}
          y={controller.contextMenu.y}
          onAction={(action) => {
            void controller.handleMenuAction(action);
          }}
        />
      ) : null}

      <UninstallAppDialog
        open={controller.uninstallDialogOpen}
        appName={controller.uninstallDialogAppName}
        isSubmitting={controller.uninstallDialogSubmitting}
        error={controller.uninstallDialogError}
        onOpenChange={controller.handleUninstallDialogOpenChange}
        onConfirm={controller.confirmUninstall}
      />
    </section>
  );
}
