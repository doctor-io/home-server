"use client";

import {
  buildActiveAppOperations,
  buildAppItems,
  requireAppActionTarget,
  resolveAppActionTarget,
  type AppActionTarget,
  type AppGridStatus,
  type AppItem,
} from "@/modules/apps/components/app-grid-presenters";
import { useInstalledApps } from "@/modules/apps/hooks/useInstalledApps";
import { useStoreActions } from "@/modules/apps/hooks/useStoreActions";
import { useStoreCatalog } from "@/modules/apps/hooks/useStoreCatalog";
import { useMemo, useState } from "react";

type AppGridMenuAction =
  | "open"
  | "start"
  | "stop"
  | "restart"
  | "logs"
  | "terminal"
  | "settings"
  | "update"
  | "copy-url"
  | "remove";

type UseAppGridControllerOptions = {
  onCopyUrl?: (target: AppActionTarget) => void;
  onOpenDashboard?: (target: AppActionTarget) => void;
  onOpenSettings?: (target: AppActionTarget) => void;
  onOpenTerminal?: (target: AppActionTarget) => void;
  onViewLogs?: (target: AppActionTarget) => void;
};

export function useAppGridController({
  onCopyUrl,
  onOpenDashboard,
  onOpenSettings,
  onOpenTerminal,
  onViewLogs,
}: UseAppGridControllerOptions) {
  const installedAppsQuery = useInstalledApps();
  const installedCatalogQuery = useStoreCatalog({
    installedOnly: true,
  });
  const {
    operationsByApp,
    uninstallApp,
    startApp,
    stopApp,
    restartApp,
    checkAppUpdates,
  } = useStoreActions();
  const [statusByAppId, setStatusByAppId] = useState<
    Record<string, AppGridStatus>
  >({});
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [uninstallAppId, setUninstallAppId] = useState<string | null>(null);
  const [uninstallError, setUninstallError] = useState<string | null>(null);
  const [uninstallPending, setUninstallPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    appId: string;
  } | null>(null);

  const installedCatalogApps = useMemo(
    () => installedCatalogQuery.data?.apps ?? [],
    [installedCatalogQuery.data?.apps],
  );
  const installedApps = useMemo(
    () => installedAppsQuery.data ?? [],
    [installedAppsQuery.data],
  );

  const apps = useMemo(
    () =>
      buildAppItems({
        installedApps,
        installedCatalogApps,
        operationsByApp,
        statusByAppId,
      }),
    [installedApps, installedCatalogApps, operationsByApp, statusByAppId],
  );

  const activeOperations = useMemo(
    () =>
      buildActiveAppOperations({
        installedApps,
        installedCatalogApps,
        operationsByApp,
      }),
    [installedApps, installedCatalogApps, operationsByApp],
  );

  const isAppsLoading =
    installedAppsQuery.isLoading || installedCatalogQuery.isLoading;
  const isAppsError =
    installedAppsQuery.isError && installedCatalogQuery.isError;
  const primaryOperation = activeOperations[0] ?? null;
  const menuApp = contextMenu
    ? (apps.find((app) => app.id === contextMenu.appId) ?? null)
    : null;
  const uninstallTarget = uninstallAppId
    ? (apps.find((app) => app.id === uninstallAppId) ?? null)
    : null;
  const menuOperation = menuApp ? operationsByApp[menuApp.id] : undefined;
  const menuTarget = menuApp ? resolveAppActionTarget(menuApp) : null;
  const menuHasDashboardUrl = Boolean(
    menuTarget && menuTarget.dashboardUrl.trim().length > 0,
  );
  const isMenuAppBusy = Boolean(
    menuOperation &&
    (menuOperation.status === "queued" || menuOperation.status === "running"),
  );

  function closeContextMenu() {
    setContextMenu(null);
    setActiveAppId(null);
  }

  function updateAppStatus(appId: string, status: AppItem["status"]) {
    setStatusByAppId((previous) => ({
      ...previous,
      [appId]: status,
    }));
  }

  function clearAppStatus(appId: string) {
    setStatusByAppId((previous) => {
      if (!(appId in previous)) return previous;
      const next = { ...previous };
      delete next[appId];
      return next;
    });
  }

  function openContextMenu(event: React.MouseEvent, app: AppItem) {
    event.preventDefault();
    setActionError(null);
    setActiveAppId(app.id);
    const x = Math.min(event.clientX, window.innerWidth - 220);
    const y = Math.min(event.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, appId: app.id });
  }

  async function openDashboardForApp(app: AppItem) {
    setActionError(null);

    try {
      const resolvedTarget = requireAppActionTarget(app, {
        requireDashboardUrl: true,
      });
      if (!resolvedTarget || resolvedTarget.dashboardUrl.trim().length === 0) {
        setActionError("No web port configured for this app.");
        return;
      }

      if (onOpenDashboard) {
        onOpenDashboard(resolvedTarget);
      } else {
        window.open(
          resolvedTarget.dashboardUrl,
          "_blank",
          "noopener,noreferrer",
        );
      }
    } catch {}
  }

  async function handleMenuAction(action: AppGridMenuAction) {
    if (!menuApp) return;

    try {
      setActionError(null);

      if (action === "open") {
        await openDashboardForApp(menuApp);
      } else if (action === "start") {
        updateAppStatus(menuApp.id, "running");
        await startApp(menuApp.id);
      } else if (action === "stop") {
        updateAppStatus(menuApp.id, "stopped");
        await stopApp(menuApp.id);
      } else if (action === "restart") {
        updateAppStatus(menuApp.id, "updating");
        try {
          await restartApp(menuApp.id);
        } finally {
          clearAppStatus(menuApp.id);
        }
      } else if (action === "update") {
        updateAppStatus(menuApp.id, "updating");
        try {
          await checkAppUpdates(menuApp.id);
        } finally {
          clearAppStatus(menuApp.id);
        }
      } else if (action === "logs") {
        const resolvedTarget = requireAppActionTarget(menuApp, {
          requireContainerName: true,
        });
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onViewLogs?.(resolvedTarget);
      } else if (action === "terminal") {
        const resolvedTarget = requireAppActionTarget(menuApp, {
          requireContainerName: true,
        });
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onOpenTerminal?.(resolvedTarget);
      } else if (action === "settings") {
        const resolvedTarget = requireAppActionTarget(menuApp);
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onOpenSettings?.(resolvedTarget);
      } else if (action === "copy-url") {
        const resolvedTarget = requireAppActionTarget(menuApp, {
          requireDashboardUrl: true,
        });
        if (!resolvedTarget) {
          setActionError("No web port configured for this app.");
          closeContextMenu();
          return;
        }

        if (onCopyUrl) {
          onCopyUrl(resolvedTarget);
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(resolvedTarget.dashboardUrl);
        }
      } else if (action === "remove") {
        setUninstallError(null);
        setUninstallAppId(menuApp.id);
      }
    } catch {}

    closeContextMenu();
  }

  async function confirmUninstall(input: { deleteData: boolean }) {
    if (!uninstallAppId) return;

    setUninstallError(null);
    setUninstallPending(true);

    try {
      await uninstallApp({
        appId: uninstallAppId,
        removeVolumes: input.deleteData,
      });
      setUninstallAppId(null);
    } catch (error) {
      setUninstallError(
        error instanceof Error ? error.message : "Unable to start uninstall.",
      );
    } finally {
      setUninstallPending(false);
    }
  }

  function handleUninstallDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) return;
    setUninstallAppId(null);
    setUninstallError(null);
  }

  return {
    actionError,
    activeAppId,
    activeOperationsCount: activeOperations.length,
    apps,
    closeContextMenu,
    confirmUninstall,
    contextMenu,
    handleMenuAction,
    handleUninstallDialogOpenChange,
    isAppsError,
    isAppsLoading,
    isMenuAppBusy,
    menuApp,
    menuHasDashboardUrl,
    openContextMenu,
    openDashboardForApp,
    primaryOperation,
    uninstallDialogAppName: uninstallTarget?.name ?? null,
    uninstallDialogError: uninstallError,
    uninstallDialogOpen: Boolean(uninstallAppId),
    uninstallDialogSubmitting: uninstallPending,
  };
}
