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
import { useState } from "react";

type AppItem = {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  status: "running" | "stopped" | "updating";
  category: string;
};

const appSeed: AppItem[] = [
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

const categories = [
  "All",
  ...Array.from(new Set(appSeed.map((a) => a.category))),
];

type AppGridProps = {
  iconSize?: "small" | "medium" | "large";
  animationsEnabled?: boolean;
};

export function AppGrid({
  iconSize = "medium",
  animationsEnabled = true,
}: AppGridProps) {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [apps, setApps] = useState(appSeed);
  const [activeAppName, setActiveAppName] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    appName: string;
  } | null>(null);

  const filtered =
    selectedCategory === "All"
      ? apps
      : apps.filter((a) => a.category === selectedCategory);
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
    ? (apps.find((a) => a.name === contextMenu.appName) ?? null)
    : null;

  function closeContextMenu() {
    setContextMenu(null);
    setActiveAppName(null);
  }

  function openContextMenu(e: React.MouseEvent, app: AppItem) {
    e.preventDefault();
    setActiveAppName(app.name);
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, appName: app.name });
  }

  function updateAppStatus(name: string, status: AppItem["status"]) {
    setApps((prev) =>
      prev.map((app) => (app.name === name ? { ...app, status } : app)),
    );
  }

  function handleDockerAction(
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

    if (action === "start") {
      updateAppStatus(menuApp.name, "running");
    } else if (action === "stop") {
      updateAppStatus(menuApp.name, "stopped");
    } else if (action === "restart" || action === "update") {
      updateAppStatus(menuApp.name, "updating");
      setTimeout(() => {
        updateAppStatus(menuApp.name, "running");
      }, 1200);
    } else if (action === "remove") {
      setApps((prev) => prev.filter((app) => app.name !== menuApp.name));
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
      <div className="grid grid-cols-4 sm:grid-cols-5 mt-24 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-5">
        {filtered.map((app) => (
          <button
            key={app.name}
            onContextMenu={(e) => openContextMenu(e, app)}
            className={`group flex flex-col items-center gap-2 p-2 rounded-xl cursor-pointer ${
              activeAppName === app.name
                ? "bg-primary/15 ring-1 ring-primary/40"
                : "hover:bg-foreground/5"
            } ${animationsEnabled ? "transition-all duration-200" : ""} ${
              animationsEnabled ? "group-active:scale-95" : ""
            }`}
            aria-label={`Open ${app.name}`}
          >
            {/* Icon */}
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
              {/* Status dot */}
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

            {/* Name */}
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

      {contextMenu && menuApp && (
        <div
          className="fixed z-[220] min-w-48 py-1.5 rounded-xl bg-popover border border-glass-border backdrop-blur-2xl shadow-2xl shadow-black/50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <AppContextMenuItem
            icon={<ExternalLink className="size-3.5" />}
            label="Open Dashboard"
            onClick={() => handleDockerAction("open")}
          />
          {menuApp.status === "running" ? (
            <AppContextMenuItem
              icon={<Square className="size-3.5" />}
              label="Stop Container"
              onClick={() => handleDockerAction("stop")}
            />
          ) : (
            <AppContextMenuItem
              icon={<Play className="size-3.5" />}
              label="Start Container"
              onClick={() => handleDockerAction("start")}
            />
          )}
          <AppContextMenuItem
            icon={<RotateCcw className="size-3.5" />}
            label="Restart Container"
            onClick={() => handleDockerAction("restart")}
            disabled={menuApp.status === "updating"}
          />
          <AppContextMenuItem
            icon={<ScrollText className="size-3.5" />}
            label="View Logs"
            onClick={() => handleDockerAction("logs")}
          />
          <AppContextMenuItem
            icon={<TerminalSquare className="size-3.5" />}
            label="Open in Terminal"
            onClick={() => handleDockerAction("terminal")}
          />
          <div className="h-px bg-border mx-2 my-1" />
          <AppContextMenuItem
            icon={<Settings2 className="size-3.5" />}
            label="App Settings"
            onClick={() => handleDockerAction("settings")}
          />
          <AppContextMenuItem
            icon={<RefreshCw className="size-3.5" />}
            label="Check Updates"
            onClick={() => handleDockerAction("update")}
            disabled={menuApp.status === "updating"}
          />
          <AppContextMenuItem
            icon={<Copy className="size-3.5" />}
            label="Copy URL"
            onClick={() => handleDockerAction("copy-url")}
          />
          <div className="h-px bg-border mx-2 my-1" />
          <AppContextMenuItem
            icon={<Trash2 className="size-3.5 text-status-red" />}
            label="Remove App"
            danger
            onClick={() => handleDockerAction("remove")}
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
