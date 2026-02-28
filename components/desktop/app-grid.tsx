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

type InstalledComposeResponse = {
  data?: {
    primary?: {
      ports?: string[];
      environment?: Record<string, string>;
    };
  };
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

const appConnectionMap: Record<
  string,
  {
    dashboardUrl: string;
    containerName: string;
  }
> = {
  plex: { dashboardUrl: "http://localhost:32400/web", containerName: "plex" },
  nextcloud: {
    dashboardUrl: "http://localhost:8080",
    containerName: "nextcloud",
  },
  "pi-hole": {
    dashboardUrl: "http://localhost:8053/admin",
    containerName: "pihole",
  },
  pihole: {
    dashboardUrl: "http://localhost:8053/admin",
    containerName: "pihole",
  },
  "home-asst": {
    dashboardUrl: "http://localhost:8123",
    containerName: "home-assistant",
  },
  "home-assistant": {
    dashboardUrl: "http://localhost:8123",
    containerName: "home-assistant",
  },
  portainer: {
    dashboardUrl: "http://localhost:9443",
    containerName: "portainer",
  },
  grafana: { dashboardUrl: "http://localhost:3000", containerName: "grafana" },
  "nginx-proxy": {
    dashboardUrl: "http://localhost:81",
    containerName: "nginx-proxy",
  },
  vaultwarden: {
    dashboardUrl: "http://localhost:8222",
    containerName: "vaultwarden",
  },
  qbittorrent: {
    dashboardUrl: "http://localhost:8081",
    containerName: "qbittorrent",
  },
  postgresql: {
    dashboardUrl: "http://localhost:5432",
    containerName: "postgres",
  },
  postgres: {
    dashboardUrl: "http://localhost:5432",
    containerName: "postgres",
  },
  jellyfin: {
    dashboardUrl: "http://localhost:8096",
    containerName: "jellyfin",
  },
  gitea: { dashboardUrl: "http://localhost:3001", containerName: "gitea" },
  immich: {
    dashboardUrl: "http://localhost:2283",
    containerName: "immich-server",
  },
  bookstack: {
    dashboardUrl: "http://localhost:6875",
    containerName: "bookstack",
  },
  "file-browser": {
    dashboardUrl: "http://localhost:8082",
    containerName: "filebrowser",
  },
  "uptime-kuma": {
    dashboardUrl: "http://localhost:3002",
    containerName: "uptime-kuma",
  },
  mailcow: { dashboardUrl: "http://localhost:8090", containerName: "mailcow" },
  matrix: {
    dashboardUrl: "http://localhost:8008",
    containerName: "matrix-synapse",
  },
  freshrss: {
    dashboardUrl: "http://localhost:8083",
    containerName: "freshrss",
  },
  minecraft: {
    dashboardUrl: "http://localhost:25565",
    containerName: "minecraft",
  },
};

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

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
    const protocol =
      typeof window !== "undefined"
        ? window.location.protocol
        : parsed.protocol;
    const hostname =
      typeof window !== "undefined"
        ? window.location.hostname
        : parsed.hostname;
    return `${protocol}//${hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

function parsePortFromUrl(value: string): number | null {
  try {
    const parsed = new URL(value);
    if (!parsed.port) return null;
    const port = Number.parseInt(parsed.port, 10);
    return Number.isInteger(port) ? port : null;
  } catch {
    return null;
  }
}

function parseHostPortFromMapping(value: string): number | null {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return null;

  const [mappingPart] = trimmed.split("/");
  const segments = mappingPart.split(":").filter(Boolean);
  if (segments.length === 0) return null;

  const hostSegment =
    segments.length >= 2 ? segments[segments.length - 2] : segments[0];
  const port = Number.parseInt(hostSegment ?? "", 10);
  return Number.isInteger(port) ? port : null;
}

function parseDashboardUrlFromComposePrimary(primary: {
  ports?: string[];
  environment?: Record<string, string>;
}): string {
  const appUrl = primary.environment?.APP_URL;
  if (typeof appUrl === "string" && appUrl.trim().length > 0) {
    return toCurrentHostUrl(appUrl.trim());
  }

  const firstPort = primary.ports
    ?.map((entry) => parseHostPortFromMapping(entry) ?? 0)
    .find((hostPort) => hostPort > 0);

  if (!firstPort) {
    return "";
  }

  const protocol =
    typeof window !== "undefined" ? window.location.protocol : "http:";
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  return `${protocol}//${hostname}:${firstPort}`;
}

function resolveAppActionTarget(app: AppItem): AppActionTarget {
  const mapped = appConnectionMap[app.id] ?? appConnectionMap[toSlug(app.name)];
  const mappedPath = mapped ? extractUrlPath(mapped.dashboardUrl) : "";
  const fallbackContainerName = app.containerName?.trim() ?? "";

  if (app.webUiPort !== null) {
    const protocol =
      typeof window !== "undefined" ? window.location.protocol : "http:";
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "localhost";

    return {
      appId: app.id,
      appName: app.name,
      dashboardUrl: `${protocol}//${hostname}:${app.webUiPort}${mappedPath}`,
      containerName: fallbackContainerName,
    };
  }

  if (mapped) {
    const dashboardUrl = toCurrentHostUrl(mapped.dashboardUrl);
    return {
      appId: app.id,
      appName: app.name,
      dashboardUrl,
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
        const mapped =
          appConnectionMap[appId] ?? appConnectionMap[toSlug(name)];
        const fallbackPort = mapped
          ? parsePortFromUrl(mapped.dashboardUrl)
          : null;
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
          webUiPort: installed?.webUiPort ?? catalog?.webUiPort ?? fallbackPort,
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
    setActiveAppId(app.id);
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, appId: app.id });
  }

  async function resolveActionTarget(
    app: AppItem,
    options?: {
      forceLookup?: boolean;
      requireContainerName?: boolean;
      requireDashboardUrl?: boolean;
    },
  ): Promise<AppActionTarget | null> {
    const fallback = resolveAppActionTarget(app);
    const shouldForceLookup = options?.forceLookup ?? false;
    const requireContainerName = options?.requireContainerName ?? false;
    const requireDashboardUrl = options?.requireDashboardUrl ?? false;

    let resolvedDashboardUrl = "";
    let resolvedContainerName = fallback.containerName.trim();

    try {
      const response = await fetch(
        `/api/v1/apps/${encodeURIComponent(app.id)}/dashboard-url`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const json = (await response.json()) as {
          url?: string;
          containerName?: string | null;
          data?: { url?: string };
        };
        const rawUrl = json.url ?? json.data?.url ?? "";
        const containerName = json.containerName?.trim() ?? "";
        if (containerName.length > 0) {
          resolvedContainerName = containerName;
        }
        if (rawUrl.trim().length > 0) {
          resolvedDashboardUrl = toCurrentHostUrl(rawUrl);
        }
      }
    } catch {
      // fallback to compose endpoint
    }

    if (!resolvedDashboardUrl) {
      try {
        const response = await fetch(
          `/api/v1/store/apps/${encodeURIComponent(app.id)}/compose?source=installed`,
          { cache: "no-store" },
        );
        if (response.ok) {
          const json = (await response.json()) as InstalledComposeResponse;
          const primary = json.data?.primary;
          if (primary) {
            resolvedDashboardUrl = parseDashboardUrlFromComposePrimary(primary);
          }
        }
      } catch {
        // keep fallback
      }
    }

    const target: AppActionTarget = {
      ...fallback,
      dashboardUrl: resolvedDashboardUrl || fallback.dashboardUrl,
      containerName: resolvedContainerName,
    };

    if (requireDashboardUrl && target.dashboardUrl.trim().length === 0) {
      return shouldForceLookup
        ? null
        : fallback.dashboardUrl.trim().length > 0
          ? fallback
          : null;
    }

    if (requireContainerName && target.containerName.trim().length === 0) {
      return null;
    }

    return target;
  }

  async function openDashboardForApp(app: AppItem) {
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
      const resolvedTarget = await resolveActionTarget(app, {
        requireDashboardUrl: true,
      });
      if (!resolvedTarget || resolvedTarget.dashboardUrl.trim().length === 0) {
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
        const resolvedTarget = await resolveActionTarget(menuApp, {
          forceLookup: true,
          requireContainerName: true,
        });
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onViewLogs?.(resolvedTarget);
      } else if (action === "terminal") {
        const resolvedTarget = await resolveActionTarget(menuApp, {
          forceLookup: true,
          requireContainerName: true,
        });
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onOpenTerminal?.(resolvedTarget);
      } else if (action === "settings") {
        const resolvedTarget = await resolveActionTarget(menuApp, {
          forceLookup: true,
        });
        if (!resolvedTarget) {
          closeContextMenu();
          return;
        }
        onOpenSettings?.(resolvedTarget);
      } else if (action === "copy-url") {
        const resolvedTarget = await resolveActionTarget(menuApp, {
          requireDashboardUrl: true,
        });
        if (!resolvedTarget) {
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
