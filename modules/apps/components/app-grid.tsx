"use client";

import { AppGridContent } from "@/modules/apps/components/app-grid-content";
import { useAppGridController } from "@/modules/apps/components/app-grid-controller";
import { AppGridContextMenu } from "@/modules/apps/components/app-grid-menu";
import type { AppActionTarget } from "@/modules/apps/components/app-grid-presenters";
import { UninstallAppDialog } from "@/modules/apps/components/uninstall-app-dialog";
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
        <div className="mt-4 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
          {controller.actionError}
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
