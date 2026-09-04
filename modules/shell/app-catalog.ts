import {
  Activity,
  Bell,
  Cpu,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  Package,
  Settings,
  ShoppingBag,
  TerminalSquare,
} from "@/components/icons/platform-icons";
import type { ComponentType } from "react";

/**
 * The single source of truth for what the desktop can open.
 *
 * The window host, the dock and the command palette all read this list, so a
 * desktop app is declared once. Window contents are not here — they close over
 * shell state and live in the shell's window registry, keyed by the same id.
 */

export type DesktopWindowId =
  | "files"
  | "settings"
  | "monitor"
  | "notifications"
  | "app-store"
  | "custom-install"
  | "app-settings"
  | "terminal"
  | "disk-manager";

type IconComponent = ComponentType<{ className?: string }>;

export type DesktopWindowSpec = {
  id: DesktopWindowId;
  /** Title bar text. A window whose title is dynamic overrides it at render. */
  title: string;
  icon: IconComponent;
  iconClassName: string;
  defaultWidth: number;
  defaultHeight: number;
  /** Second line of this window's entry in the command palette. */
  commandSubtitle: string;
};

export const DESKTOP_WINDOWS: DesktopWindowSpec[] = [
  {
    id: "files",
    title: "Files",
    icon: FolderOpen,
    iconClassName: "size-4 text-sky-400",
    defaultWidth: 1100,
    defaultHeight: 679,
    commandSubtitle: "Folder and file browser",
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    iconClassName: "size-4 text-muted-foreground",
    defaultWidth: 860,
    defaultHeight: 620,
    commandSubtitle: "System preferences",
  },
  {
    id: "monitor",
    title: "Monitor",
    icon: Activity,
    iconClassName: "size-4 text-primary",
    defaultWidth: 1120,
    defaultHeight: 700,
    commandSubtitle: "System performance",
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    iconClassName: "size-4 text-primary",
    defaultWidth: 640,
    defaultHeight: 520,
    commandSubtitle: "Activity feed",
  },
  {
    id: "app-store",
    title: "App Store",
    icon: ShoppingBag,
    iconClassName: "size-4 text-sky-400",
    defaultWidth: 1080,
    defaultHeight: 680,
    commandSubtitle: "Browse and install apps",
  },
  {
    id: "custom-install",
    title: "Install Custom App",
    icon: Package,
    iconClassName: "size-4 text-primary",
    defaultWidth: 720,
    defaultHeight: 600,
    commandSubtitle: "Install from a compose file",
  },
  {
    id: "app-settings",
    title: "App Settings",
    icon: Settings,
    iconClassName: "size-4 text-primary",
    defaultWidth: 920,
    defaultHeight: 700,
    commandSubtitle: "App configuration",
  },
  {
    id: "terminal",
    title: "Terminal",
    icon: TerminalSquare,
    iconClassName: "size-4 text-emerald-400",
    defaultWidth: 980,
    defaultHeight: 620,
    commandSubtitle: "Shell and logs",
  },
  {
    id: "disk-manager",
    title: "Disk Manager",
    icon: HardDrive,
    iconClassName: "size-4 text-amber-400",
    defaultWidth: 980,
    defaultHeight: 640,
    commandSubtitle: "Storage management",
  },
];

export const DESKTOP_WINDOWS_BY_ID = new Map(
  DESKTOP_WINDOWS.map((spec) => [spec.id, spec] as const),
);

/**
 * Dock entries, in dock order. `apps` is the home grid rather than a window,
 * which is why the dock is its own list instead of a flag on the windows above.
 */
export type DockAppId = "apps" | DesktopWindowId;

export type DockAppSpec = {
  id: DockAppId;
  name: string;
  icon: IconComponent;
  iconBg: string;
};

export const DOCK_APPS: DockAppSpec[] = [
  { id: "apps",      name: "Home",      icon: LayoutGrid,     iconBg: "bg-blue-500/80"    },
  { id: "terminal",  name: "Terminal",  icon: TerminalSquare, iconBg: "bg-slate-700/90"   },
  { id: "files",     name: "Files",     icon: FolderOpen,     iconBg: "bg-amber-500/80"   },
  { id: "monitor",   name: "Monitor",   icon: Cpu,            iconBg: "bg-emerald-600/80" },
  { id: "app-store", name: "App Store", icon: ShoppingBag,    iconBg: "bg-purple-600/80"  },
  { id: "settings",  name: "Settings",  icon: Settings,       iconBg: "bg-zinc-600/80"    },
];
