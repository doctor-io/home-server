"use client";

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
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
import { logClientAction } from "@/lib/client/logger";
import type { StoreAppSummary } from "@/lib/shared/contracts/apps";

type AppItem = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  status: "running" | "stopped" | "updating";
  category: string;
  webUiPort: number | null;
};

type AppVisualSeedItem = Omit<AppItem, "id" | "webUiPort">;

type AppActionTarget = {
  appName: string;
  dashboardUrl: string;
  containerName: string;
};

const appSeed: AppVisualSeedItem[] = [
  {
    name: "Plex",
    icon: Film,
    color: "text-amber-400",
    bgColor: "bg-amber-500/20",
    status: "running",
    category: "Media",
  },
  {
    name: "Nextcloud",
    icon: Cloud,
    color: "text-sky-400",
    bgColor: "bg-sky-500/20",
    status: "running",
    category: "Productivity",
  },
  {
    name: "Pi-hole",
    icon: Shield,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    status: "running",
    category: "Network",
  },
  {
    name: "Home Asst.",
    icon: Home,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
    status: "running",
    category: "Automation",
  },
  {
    name: "Portainer",
    icon: Container,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    status: "running",
    category: "System",
  },
  {
    name: "Grafana",
    icon: BarChart3,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
    status: "running",
    category: "System",
  },
  {
    name: "Nginx Proxy",
    icon: Globe,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    status: "running",
    category: "Network",
  },
  {
    name: "Vaultwarden",
    icon: Lock,
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/20",
    status: "running",
    category: "Security",
  },
  {
    name: "qBittorrent",
    icon: Download,
    color: "text-teal-400",
    bgColor: "bg-teal-500/20",
    status: "stopped",
    category: "Downloads",
  },
  {
    name: "PostgreSQL",
    icon: Database,
    color: "text-blue-300",
    bgColor: "bg-blue-600/20",
    status: "running",
    category: "System",
  },
  {
    name: "Jellyfin",
    icon: Music,
    color: "text-sky-300",
    bgColor: "bg-sky-600/20",
    status: "running",
    category: "Media",
  },
  {
    name: "Gitea",
    icon: Code,
    color: "text-green-400",
    bgColor: "bg-green-600/20",
    status: "running",
    category: "Development",
  },
  {
    name: "Immich",
    icon: Camera,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
    status: "updating",
    category: "Media",
  },
  {
    name: "Bookstack",
    icon: BookOpen,
    color: "text-yellow-400",
    bgColor: "bg-yellow-600/20",
    status: "running",
    category: "Productivity",
  },
  {
    name: "File Browser",
    icon: FolderOpen,
    color: "text-stone-400",
    bgColor: "bg-stone-500/20",
    status: "running",
    category: "Productivity",
  },
  {
    name: "Uptime Kuma",
    icon: Server,
    color: "text-lime-400",
    bgColor: "bg-lime-500/20",
    status: "running",
    category: "System",
  },
  {
    name: "Mailcow",
    icon: Mail,
    color: "text-rose-400",
    bgColor: "bg-rose-500/20",
    status: "stopped",
    category: "Communication",
  },
  {
    name: "Matrix",
    icon: MessageSquare,
    color: "text-emerald-300",
    bgColor: "bg-emerald-600/20",
    status: "running",
    category: "Communication",
  },
  {
    name: "FreshRSS",
    icon: Rss,
    color: "text-orange-300",
    bgColor: "bg-orange-600/20",
    status: "running",
    category: "Productivity",
  },
  {
    name: "Minecraft",
    icon: Gamepad2,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
    status: "stopped",
    category: "Gaming",
  },
];

const appConnectionMap: Record<
  string,
  {
    dashboardUrl: string;
    containerName: string;
  }
> = {
  Plex: { dashboardUrl: "http://localhost:32400/web", containerName: "plex" },
  Nextcloud: { dashboardUrl: "http://localhost:8080", containerName: "nextcloud" },
  "Pi-hole": { dashboardUrl: "http://localhost:8053/admin", containerName: "pihole" },
  "Home Asst.": { dashboardUrl: "http://localhost:8123", containerName: "home-assistant" },
  Portainer: { dashboardUrl: "http://localhost:9443", containerName: "portainer" },
  Grafana: { dashboardUrl: "http://localhost:3000", containerName: "grafana" },
  "Nginx Proxy": { dashboardUrl: "http://localhost:81", containerName: "nginx-proxy" },
  Vaultwarden: { dashboardUrl: "http://localhost:8222", containerName: "vaultwarden" },
  qBittorrent: { dashboardUrl: "http://localhost:8081", containerName: "qbittorrent" },
  PostgreSQL: { dashboardUrl: "http://localhost:5432", containerName: "postgres" },
  Jellyfin: { dashboardUrl: "http://localhost:8096", containerName: "jellyfin" },
  Gitea: { dashboardUrl: "http://localhost:3001", containerName: "gitea" },
  Immich: { dashboardUrl: "http://localhost:2283", containerName: "immich-server" },
  Bookstack: { dashboardUrl: "http://localhost:6875", containerName: "bookstack" },
  "File Browser": { dashboardUrl: "http://localhost:8082", containerName: "filebrowser" },
  "Uptime Kuma": { dashboardUrl: "http://localhost:3002", containerName: "uptime-kuma" },
  Mailcow: { dashboardUrl: "http://localhost:8090", containerName: "mailcow" },
  Matrix: { dashboardUrl: "http://localhost:8008", containerName: "matrix-synapse" },
  FreshRSS: { dashboardUrl: "http://localhost:8083", containerName: "freshrss" },
  Minecraft: { dashboardUrl: "http://localhost:25565", containerName: "minecraft" },
};

function toSlug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function extractUrlPath(value: string) {
  try {
    const parsed = new URL(value);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path === "/" ? "" : path;
  } catch {
    return "";
  }
}

function toCurrentHostUrl(value: string) {
  try {
    const parsed = new URL(value);
    const protocol = typeof window !== "undefined" ? window.location.protocol : parsed.protocol;
    const hostname = typeof window !== "undefined" ? window.location.hostname : parsed.hostname;
    return `${protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

function toGridStatus(status: StoreAppSummary["status"]): AppItem["status"] {
  if (status === "installing" || status === "updating" || status === "uninstalling") {
    return "updating";
  }

  if (status === "installed") {
    return "running";
  }

  return "stopped";
}

function mapStoreAppToGridItem(app: StoreAppSummary): AppItem {
  const visual = appSeed.find((item) => item.name === app.name);

  return {
    id: app.id,
    name: app.name,
    icon: visual?.icon ?? Container,
    color: visual?.color ?? "text-blue-300",
    bgColor: visual?.bgColor ?? "bg-blue-600/20",
    status: toGridStatus(app.status),
    category: app.categories[0] ?? visual?.category ?? "Apps",
    webUiPort: app.webUiPort,
  };
}

function resolveAppActionTarget(app: AppItem): AppActionTarget {
  const mapped = appConnectionMap[app.name];

  if (app.webUiPort !== null) {
    const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
    const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
    const path = mapped ? extractUrlPath(mapped.dashboardUrl) : "";

    return {
      appName: app.name,
      dashboardUrl: `${protocol}//${hostname}:${app.webUiPort}${path}`,
      containerName: mapped?.containerName ?? toSlug(app.name),
    };
  }

  if (mapped) {
    const dashboardUrl = toCurrentHostUrl(mapped.dashboardUrl);
    return {
      appName: app.name,
      dashboardUrl,
      containerName: mapped.containerName,
    };
  }

  const protocol = typeof window !== "undefined" ? window.location.protocol : "http:";
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";

  return {
    appName: app.name,
    dashboardUrl: `${protocol}//${hostname}`,
    containerName: toSlug(app.name),
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
  const installedAppsQuery = useStoreCatalog({
    installedOnly: true,
  });
  const [statusByAppId, setStatusByAppId] = useState<Record<string, AppItem["status"]>>({});
  const [removedAppIds, setRemovedAppIds] = useState<Record<string, boolean>>({});
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    appId: string;
  } | null>(null);

  const apps = useMemo(() => {
    const source = installedAppsQuery.data ?? [];

    return source
      .map(mapStoreAppToGridItem)
      .filter((app) => !removedAppIds[app.id])
      .map((app) => ({
        ...app,
        status: statusByAppId[app.id] ?? app.status,
      }));
  }, [installedAppsQuery.data, removedAppIds, statusByAppId]);

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

  function closeContextMenu() {
    setContextMenu(null);
    setActiveAppId(null);
  }

  function openContextMenu(e: React.MouseEvent, app: AppItem) {
    e.preventDefault();
    setActiveAppId(app.id);
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, appId: app.id });
  }

  function updateAppStatus(appId: string, status: AppItem["status"]) {
    setStatusByAppId((previous) => ({
      ...previous,
      [appId]: status,
    }));
  }

  function openDashboardForApp(app: AppItem) {
    const target = resolveAppActionTarget(app);

    logClientAction({
      layer: "hook",
      action: "desktop.appGrid.open",
      status: "start",
      meta: {
        appName: target.appName,
      },
    });

    try {
      if (onOpenDashboard) {
        onOpenDashboard(target);
      } else {
        window.open(target.dashboardUrl, "_blank", "noopener,noreferrer");
      }

      logClientAction({
        layer: "hook",
        action: "desktop.appGrid.open",
        status: "success",
        meta: {
          appName: target.appName,
          dashboardUrl: target.dashboardUrl,
        },
      });
    } catch (error) {
      logClientAction({
        level: "error",
        layer: "hook",
        action: "desktop.appGrid.open",
        status: "error",
        meta: {
          appName: target.appName,
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
    const target = resolveAppActionTarget(menuApp);

    logClientAction({
      layer: "hook",
      action: "desktop.appGrid.contextAction",
      status: "start",
      meta: {
        action,
        appName: target.appName,
      },
    });

    try {
      if (action === "open") {
        openDashboardForApp(menuApp);
      } else if (action === "start") {
        updateAppStatus(menuApp.id, "running");
      } else if (action === "stop") {
        updateAppStatus(menuApp.id, "stopped");
      } else if (action === "restart" || action === "update") {
        updateAppStatus(menuApp.id, "updating");
        setTimeout(() => {
          updateAppStatus(menuApp.id, "running");
        }, 1200);
      } else if (action === "logs") {
        onViewLogs?.(target);
      } else if (action === "terminal") {
        onOpenTerminal?.(target);
      } else if (action === "settings") {
        onOpenSettings?.(target);
      } else if (action === "copy-url") {
        if (onCopyUrl) {
          onCopyUrl(target);
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(target.dashboardUrl);
        }
      } else if (action === "remove") {
        setRemovedAppIds((previous) => ({
          ...previous,
          [menuApp.id]: true,
        }));
      }

      logClientAction({
        layer: "hook",
        action: "desktop.appGrid.contextAction",
        status: "success",
        meta: {
          action,
          appName: target.appName,
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
          appName: target.appName,
        },
        error,
      });
    }

    closeContextMenu();
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
      {installedAppsQuery.isLoading ? (
        <div className="mt-24 text-xs text-muted-foreground">Loading installed apps...</div>
      ) : installedAppsQuery.isError ? (
        <div className="mt-24 text-xs text-status-red">Unable to load installed apps.</div>
      ) : filtered.length === 0 ? (
        <div className="mt-24 text-xs text-muted-foreground">No installed apps found.</div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 mt-24 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-5">
          {filtered.map((app) => (
            <button
              key={app.id}
              onClick={() => openDashboardForApp(app)}
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
                  className={`${iconContainerClass} flex items-center justify-center ${app.bgColor} ${app.color} shadow-lg shadow-black/20 ${
                    animationsEnabled
                      ? "transition-transform duration-200 group-hover:scale-110"
                      : ""
                  }`}
                >
                  <app.icon className={iconGlyphClass} />
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
            onClick={() => void handleDockerAction("copy-url")}
          />
          <div className="h-px bg-border mx-2 my-1" />
          <AppContextMenuItem
            icon={<Trash2 className="size-3.5 text-status-red" />}
            label="Remove App"
            danger
            onClick={() => void handleDockerAction("remove")}
          />
        </div>
      )}
    </section>
  );
}

function AppContextMenuItem({
  icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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
