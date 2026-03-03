"use client";

import { UninstallAppDialog } from "@/components/desktop/uninstall-app-dialog";
import { useInstalledApps } from "@/hooks/useInstalledApps";
import { useStoreActions } from "@/hooks/useStoreActions";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { logClientAction } from "@/lib/client/logger";
import {
  BarChart3,
  BookOpen,
  Camera,
  Cloud,
  Code,
  Container,
  Copy,
  Database,
  Download,
  ExternalLink,
  Film,
  FolderOpen,
  Gamepad2,
  Globe,
  Home,
  Lock,
  Mail,
  MessageSquare,
  Music,
  Play,
  RefreshCw,
  RotateCcw,
  Rss,
  ScrollText,
  Server,
  Settings2,
  Shield,
  Square,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

type AppItem = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  logoUrl: string | null;
  color: string;
  bgColor: string;
  status: "running" | "stopped" | "updating";
  category: string;
  webUiPort: number | null;
  containerName: string | null;
};

export type AppActionTarget = {
  appId: string;
  appName: string;
  dashboardUrl: string;
  containerName: string;
};

const iconByKeyword: Array<{
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}> = [
  { keywords: ["plex", "jellyfin"], icon: Film, category: "Media" },
  { keywords: ["nextcloud", "cloud"], icon: Cloud, category: "Productivity" },
  { keywords: ["pihole", "pi-hole"], icon: Shield, category: "Network" },
  {
    keywords: ["home assistant", "home-asst"],
    icon: Home,
    category: "Automation",
  },
  { keywords: ["portainer", "docker"], icon: Container, category: "System" },
  { keywords: ["grafana"], icon: BarChart3, category: "System" },
  { keywords: ["proxy", "nginx"], icon: Globe, category: "Network" },
  {
    keywords: ["vaultwarden", "auth", "2fauth"],
    icon: Lock,
    category: "Security",
  },
  {
    keywords: ["qbittorrent", "torrent"],
    icon: Download,
    category: "Downloads",
  },
  {
    keywords: ["postgres", "mysql", "database"],
    icon: Database,
    category: "System",
  },
  { keywords: ["music", "audio"], icon: Music, category: "Media" },
  { keywords: ["gitea", "git"], icon: Code, category: "Development" },
  { keywords: ["immich", "photo"], icon: Camera, category: "Media" },
  { keywords: ["book", "wiki"], icon: BookOpen, category: "Productivity" },
  { keywords: ["file"], icon: FolderOpen, category: "Productivity" },
  { keywords: ["uptime", "kuma"], icon: Server, category: "System" },
  { keywords: ["mail"], icon: Mail, category: "Communication" },
  {
    keywords: ["matrix", "chat"],
    icon: MessageSquare,
    category: "Communication",
  },
  { keywords: ["rss"], icon: Rss, category: "Productivity" },
  { keywords: ["minecraft", "game"], icon: Gamepad2, category: "Gaming" },
];

const visualPalette = [
  { color: "text-sky-300", bgColor: "bg-sky-600/20" },
  { color: "text-emerald-300", bgColor: "bg-emerald-600/20" },
  { color: "text-amber-300", bgColor: "bg-amber-600/20" },
  { color: "text-violet-300", bgColor: "bg-violet-600/20" },
  { color: "text-rose-300", bgColor: "bg-rose-600/20" },
  { color: "text-cyan-300", bgColor: "bg-cyan-600/20" },
  { color: "text-lime-300", bgColor: "bg-lime-600/20" },
  { color: "text-orange-300", bgColor: "bg-orange-600/20" },
] as const;


function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickVisual(appName: string, appId: string) {
  const name = appName.toLowerCase();
  const matched =
    iconByKeyword.find((entry) =>
      entry.keywords.some((keyword) => name.includes(keyword)),
    ) ?? null;
  const palette = visualPalette[hashText(appId) % visualPalette.length];

  return {
    icon: matched?.icon ?? Container,
    category: matched?.category ?? "Apps",
    color: palette.color,
    bgColor: palette.bgColor,
  };
}

function resolveAppActionTarget(app: AppItem): AppActionTarget {
  const fallbackContainerName = app.containerName?.trim() ?? "";

  if (app.webUiPort !== null) {
    const protocol =
      typeof window !== "undefined" ? window.location.protocol : "http:";
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "localhost";

    return {
      appId: app.id,
      appName: app.name,
      dashboardUrl: `${protocol}//${hostname}:${app.webUiPort}`,
      containerName: fallbackContainerName,
    };
  }

  return {
    appId: app.id,
    appName: app.name,
    dashboardUrl: "",
    containerName: fallbackContainerName,
  };
}

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
    Record<string, AppItem["status"]>
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
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());

  const apps = useMemo(() => {
    const installedApps = installedAppsQuery.data ?? [];
    const installedCatalog = installedCatalogQuery.data ?? [];
    const installedById = new Map(installedApps.map((app) => [app.id, app]));
    const catalogById = new Map(installedCatalog.map((app) => [app.id, app]));
    const ids = Array.from(
      new Set([...installedById.keys(), ...catalogById.keys()]),
    );

    return ids
      .map((appId) => {
        const installed = installedById.get(appId);
        const catalog = catalogById.get(appId);
        const name = catalog?.name ?? installed?.name ?? appId;
        const visual = pickVisual(name, appId);

        let derivedStatus: AppItem["status"] = "stopped";
        if (
          catalog?.status === "installing" ||
          catalog?.status === "updating"
        ) {
          derivedStatus = "updating";
        } else if (installed?.status === "running") {
          derivedStatus = "running";
        } else if (installed?.status === "stopped") {
          derivedStatus = "stopped";
        }
        const operationState = operationsByApp[appId];
        if (
          operationState &&
          (operationState.status === "queued" ||
            operationState.status === "running")
        ) {
          derivedStatus = "updating";
        }
        const optimisticStatus = statusByAppId[appId];
        if (optimisticStatus) {
          derivedStatus = optimisticStatus;
        }

        return {
          id: appId,
          name,
          icon: visual.icon,
          logoUrl: catalog?.logoUrl ?? null,
          color: visual.color,
          bgColor: visual.bgColor,
          status: derivedStatus,
          category: catalog?.categories[0] ?? visual.category,
          webUiPort: installed?.webUiPort ?? null,
          containerName: installed?.containerName ?? null,
        } satisfies AppItem;
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [
    installedAppsQuery.data,
    installedCatalogQuery.data,
    operationsByApp,
    statusByAppId,
  ]);

  const isAppsLoading =
    installedAppsQuery.isLoading || installedCatalogQuery.isLoading;
  const isAppsError =
    installedAppsQuery.isError && installedCatalogQuery.isError;

  const filtered = apps;
  const iconContainerClass =
    iconSize === "small"
      ? "size-12 rounded-xl"
      : iconSize === "large"
        ? "size-16 rounded-3xl"
        : "size-14 rounded-2xl";
  const iconGlyphClass =
    iconSize === "small"
      ? "size-6"
      : iconSize === "large"
        ? "size-8"
        : "size-7";

  const menuApp = contextMenu
    ? (apps.find((a) => a.id === contextMenu.appId) ?? null)
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

  function openContextMenu(e: React.MouseEvent, app: AppItem) {
    e.preventDefault();
    setActionError(null);
    setActiveAppId(app.id);
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, appId: app.id });
  }

  function resolveActionTarget(
    app: AppItem,
    options?: {
      requireContainerName?: boolean;
      requireDashboardUrl?: boolean;
    },
  ): AppActionTarget | null {
    const fallback = resolveAppActionTarget(app);
    const requireContainerName = options?.requireContainerName ?? false;
    const requireDashboardUrl = options?.requireDashboardUrl ?? false;

    if (requireDashboardUrl && fallback.dashboardUrl.trim().length === 0) {
      return null;
    }

    if (requireContainerName && fallback.containerName.trim().length === 0) {
      return null;
    }

    return fallback;
  }

  async function openDashboardForApp(app: AppItem) {
    setActionError(null);
    const fallbackTarget = resolveAppActionTarget(app);

    logClientAction({
      layer: "hook",
      action: "desktop.appGrid.open",
      status: "start",
      meta: {
        appName: fallbackTarget.appName,
      },
    });

    try {
      const resolvedTarget = resolveActionTarget(app, {
        requireDashboardUrl: true,
      });
      if (!resolvedTarget || resolvedTarget.dashboardUrl.trim().length === 0) {
        setActionError("No web port configured for this app.");
        logClientAction({
          level: "warn",
          layer: "hook",
          action: "desktop.appGrid.open",
          status: "error",
          meta: {
            appName: fallbackTarget.appName,
          },
          message: "Dashboard URL unavailable for app",
        });
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

      logClientAction({
        layer: "hook",
        action: "desktop.appGrid.open",
        status: "success",
        meta: {
          appName: resolvedTarget.appName,
          dashboardUrl: resolvedTarget.dashboardUrl,
        },
      });
    } catch (error) {
      logClientAction({
        level: "error",
        layer: "hook",
        action: "desktop.appGrid.open",
        status: "error",
        meta: {
          appName: fallbackTarget.appName,
        },
        error,
      });
    }
  }

  async function handleDockerAction(
    action:
      | "open"
      | "start"
      | "stop"
      | "restart"
      | "logs"
      | "terminal"
      | "settings"
      | "update"
      | "copy-url"
      | "remove",
  ) {
    if (!menuApp) return;
    const fallbackTarget = resolveAppActionTarget(menuApp);

    logClientAction({
      layer: "hook",
      action: "desktop.appGrid.contextAction",
      status: "start",
      meta: {
        action,
        appName: fallbackTarget.appName,
      },
    });

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
        const resolvedTarget = resolveActionTarget(menuApp, {
          requireContainerName: true,
        });
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onViewLogs?.(resolvedTarget);
      } else if (action === "terminal") {
        const resolvedTarget = resolveActionTarget(menuApp, {
          requireContainerName: true,
        });
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onOpenTerminal?.(resolvedTarget);
      } else if (action === "settings") {
        const resolvedTarget = resolveActionTarget(menuApp);
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onOpenSettings?.(resolvedTarget);
      } else if (action === "copy-url") {
        const resolvedTarget = resolveActionTarget(menuApp, {
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

      logClientAction({
        layer: "hook",
        action: "desktop.appGrid.contextAction",
        status: "success",
        meta: {
          action,
          appName: fallbackTarget.appName,
        },
      });
    } catch (error) {
      logClientAction({
        level: "error",
        layer: "hook",
        action: "desktop.appGrid.contextAction",
        status: "error",
        meta: {
          action,
          appName: fallbackTarget.appName,
        },
        error,
      });
    }

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

  return (
    <section
      className="flex-1 px-6 pt-4 pb-6 overflow-y-auto"
      onClick={closeContextMenu}
    >
      {/* Category filter pills */}
      {/* <nav className="flex items-center gap-2 mb-8 flex-wrap" aria-label="Filter by category">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              selectedCategory === cat
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-glass border border-glass-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </nav> */}

      {/* App icon grid - like a real desktop */}
      {actionError ? (
        <div className="mt-4 rounded-lg border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
          {actionError}
        </div>
      ) : null}

      {isAppsLoading && filtered.length === 0 ? (
        <div className="mt-24 text-xs text-muted-foreground">
          Loading apps...
        </div>
      ) : isAppsError && filtered.length === 0 ? (
        <div className="mt-24 text-xs text-status-red">
          Unable to load apps.
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-24 text-xs text-muted-foreground">
          No apps found.
        </div>
      ) : (
        <div className="mt-24 grid justify-center gap-x-2 gap-y-5 grid-cols-[repeat(4,minmax(0,5.5rem))] sm:grid-cols-[repeat(5,minmax(0,5.5rem))] md:grid-cols-[repeat(6,minmax(0,5.5rem))] lg:grid-cols-[repeat(8,minmax(0,5.5rem))] xl:grid-cols-[repeat(10,minmax(0,5.5rem))]">
          {filtered.map((app) => (
            <button
              key={app.id}
              onClick={() => void openDashboardForApp(app)}
              onContextMenu={(e) => openContextMenu(e, app)}
              className={`group flex flex-col items-center gap-2 p-2 rounded-xl cursor-pointer ${
                activeAppId === app.id
                  ? "bg-primary/15 ring-1 ring-primary/40"
                  : "hover:bg-foreground/5"
              } ${animationsEnabled ? "transition-all duration-200" : ""} ${
                animationsEnabled ? "group-active:scale-95" : ""
              }`}
              aria-label={`Open ${app.name}`}
            >
              <div className="relative">
                <div
                  className={`${iconContainerClass} flex items-center justify-center ${!app.logoUrl ? `${app.bgColor} ${app.color}` : "bg-white/90"} shadow-lg shadow-black/20 ${
                    animationsEnabled
                      ? "transition-transform duration-200 group-hover:scale-110"
                      : ""
                  } overflow-hidden`}
                >
                  {app.logoUrl ? (
                    <>
                      {!loadedImages.has(app.logoUrl) && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`${iconGlyphClass} animate-pulse`}>
                            <app.icon className="w-full h-full opacity-30" />
                          </div>
                        </div>
                      )}
                      <img
                        src={app.logoUrl}
                        alt={`${app.name} logo`}
                        className="w-full h-full object-contain p-1.5 rounded-xl"
                        loading="lazy"
                        decoding="async"
                        onLoad={() => {
                          setLoadedImages((prev) =>
                            new Set(prev).add(app.logoUrl!),
                          );
                        }}
                        onError={(e) => {
                          const img = e.currentTarget;
                          const container = img.parentElement;
                          if (container) {
                            img.style.display = "none";
                            container.classList.remove("bg-white/90");
                            container.classList.add(app.bgColor, app.color);
                            const fallback = container.querySelector(
                              "[data-fallback-icon]",
                            );
                            if (fallback instanceof HTMLElement) {
                              fallback.style.display = "block";
                            }
                          }
                        }}
                      />
                      <app.icon
                        className={`${iconGlyphClass} hidden`}
                        data-fallback-icon
                      />
                    </>
                  ) : (
                    <app.icon className={iconGlyphClass} />
                  )}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background ${
                    app.status === "running"
                      ? "bg-status-green"
                      : app.status === "updating"
                        ? `bg-status-amber ${animationsEnabled ? "animate-pulse" : ""}`
                        : "bg-muted-foreground/40"
                  }`}
                />
              </div>

              <span
                className={`max-w-[4.5rem] truncate text-center text-xs leading-tight font-medium text-foreground/90 ${
                  animationsEnabled
                    ? "transition-colors group-hover:text-foreground"
                    : ""
                }`}
              >
                {app.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {contextMenu && menuApp && (
        <div
          className="fixed z-[220] min-w-48 py-1.5 rounded-xl bg-popover border border-glass-border backdrop-blur-2xl shadow-2xl shadow-black/50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <AppContextMenuItem
            icon={<ExternalLink className="size-3.5" />}
            label="Open Dashboard"
            disabled={!menuHasDashboardUrl}
            title={!menuHasDashboardUrl ? "No web port configured for this app." : undefined}
            onClick={() => void handleDockerAction("open")}
          />
          {menuApp.status === "running" ? (
            <AppContextMenuItem
              icon={<Square className="size-3.5" />}
              label="Stop Container"
              onClick={() => void handleDockerAction("stop")}
            />
          ) : (
            <AppContextMenuItem
              icon={<Play className="size-3.5" />}
              label="Start Container"
              onClick={() => void handleDockerAction("start")}
            />
          )}
          <AppContextMenuItem
            icon={<RotateCcw className="size-3.5" />}
            label="Restart Container"
            onClick={() => void handleDockerAction("restart")}
            disabled={menuApp.status === "updating"}
          />
          <AppContextMenuItem
            icon={<ScrollText className="size-3.5" />}
            label="View Logs"
            onClick={() => void handleDockerAction("logs")}
          />
          <AppContextMenuItem
            icon={<TerminalSquare className="size-3.5" />}
            label="Open in Terminal"
            onClick={() => void handleDockerAction("terminal")}
          />
          <div className="h-px bg-border mx-2 my-1" />
          <AppContextMenuItem
            icon={<Settings2 className="size-3.5" />}
            label="App Settings"
            onClick={() => void handleDockerAction("settings")}
          />
          <AppContextMenuItem
            icon={<RefreshCw className="size-3.5" />}
            label="Check Updates"
            onClick={() => void handleDockerAction("update")}
            disabled={menuApp.status === "updating"}
          />
          <AppContextMenuItem
            icon={<Copy className="size-3.5" />}
            label="Copy URL"
            disabled={!menuHasDashboardUrl}
            title={!menuHasDashboardUrl ? "No web port configured for this app." : undefined}
            onClick={() => void handleDockerAction("copy-url")}
          />
          <div className="h-px bg-border mx-2 my-1" />
          <AppContextMenuItem
            icon={<Trash2 className="size-3.5 text-status-red" />}
            label="Remove App"
            danger
            disabled={isMenuAppBusy}
            onClick={() => void handleDockerAction("remove")}
          />
        </div>
      )}

      <UninstallAppDialog
        open={Boolean(uninstallAppId)}
        appName={uninstallTarget?.name ?? null}
        isSubmitting={uninstallPending}
        error={uninstallError}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setUninstallAppId(null);
            setUninstallError(null);
          }
        }}
        onConfirm={confirmUninstall}
      />
    </section>
  );
}

function AppContextMenuItem({
  icon,
  label,
  danger,
  disabled,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors ${
        danger
          ? "text-status-red hover:bg-status-red/10 disabled:hover:bg-transparent"
          : "text-foreground hover:bg-secondary/50"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {icon}
      {label}
    </button>
  );
}
