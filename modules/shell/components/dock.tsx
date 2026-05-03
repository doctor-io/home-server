"use client";

import {
  ShoppingBag   as AppStore24Regular,
  LayoutGrid    as GridDotsRegular,
  FolderOpen    as OpenFolderRegular,
  Cpu           as PulseRegular,
  Settings      as SettingsRegular,
  TerminalSquare as WindowConsoleRegular,
} from "@/components/icons/platform-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OsIcon } from "@/components/icons/OsIcon";
import { APP_ICONS } from "@/components/icons/icon-assets";
import { useRef, useState } from "react";

export type DockItemDef = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
};

export const dockItemDefs: DockItemDef[] = [
  { id: "apps",      name: "Apps",      icon: GridDotsRegular,      iconBg: "bg-blue-500/80" },
  { id: "terminal",  name: "Terminal",  icon: WindowConsoleRegular, iconBg: "bg-slate-700/90" },
  { id: "files",     name: "Files",     icon: OpenFolderRegular,    iconBg: "bg-amber-500/80" },
  { id: "monitor",   name: "Monitor",   icon: PulseRegular,         iconBg: "bg-emerald-600/80" },
  { id: "app-store", name: "App Store", icon: AppStore24Regular,    iconBg: "bg-purple-600/80" },
  { id: "settings",  name: "Settings",  icon: SettingsRegular,      iconBg: "bg-zinc-600/80" },
];

type DockProps = {
  activeWindows?: string[];
  focusedWindow?: string | null;
  onItemClick?: (id: string) => void;
  position?: "bottom" | "left" | "right";
  animationsEnabled?: boolean;
};

export function Dock({
  activeWindows = [],
  focusedWindow = null,
  onItemClick,
  position = "bottom",
  animationsEnabled = true,
}: DockProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const isVertical = position === "left" || position === "right";

  function getScale(index: number) {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.35;
    if (distance === 1) return 1.15;
    if (distance === 2) return 1.05;
    return 1;
  }

  const dockPositionClass =
    position === "bottom"
      ? "fixed bottom-4 left-1/2 -translate-x-1/2"
      : position === "left"
        ? "fixed left-4 top-1/2 -translate-y-1/2"
        : "fixed right-4 top-1/2 -translate-y-1/2";

  return (
    <div className={`${dockPositionClass} z-50`}>
      <nav
        ref={dockRef}
        className={`flex gap-3 border border-white/[0.09] rounded-[calc(var(--radius)+0.375rem)] shadow-2xl shadow-black/40 ${
          isVertical
            ? "flex-col items-center px-2.5 py-3"
            : "items-end px-3 py-2.5"
        }`}
        style={{
          background: "var(--system-surface)",
          backdropFilter: "blur(40px) saturate(160%)",
          boxShadow: "var(--system-shadow-dock), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.07)",
        }}
        onMouseLeave={() => setHoveredIndex(null)}
        aria-label="Quick launch dock"
      >
        {dockItemDefs.map((item, index) => {
          const scale = animationsEnabled ? getScale(index) : 1;
          const isRunning = activeWindows.includes(item.id);
          const isFocused = focusedWindow === item.id;
          const osSrc = APP_ICONS[item.id];

          const iconFallback = (
            <div
              className={`size-full rounded-2xl flex items-center justify-center ${item.iconBg}`}
            >
              <item.icon className="size-5 text-white" />
            </div>
          );

          return (
            <div key={item.id} className="flex flex-col items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onMouseEnter={() => setHoveredIndex(index)}
                    onClick={() => onItemClick?.(item.id)}
                    style={{
                      transform: `scale(${scale})`,
                      transition: animationsEnabled
                        ? "transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
                        : "none",
                    }}
                    className="relative size-11 rounded-2xl overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    aria-label={item.name}
                    aria-pressed={isFocused}
                  >
                    <OsIcon
                      src={osSrc}
                      alt={item.name}
                      className={`size-full rounded-2xl object-contain transition-[box-shadow] duration-150 ${
                        isFocused
                          ? "shadow-[0_0_0_2px_hsl(var(--primary)/0.5),0_2px_8px_rgba(0,0,0,0.3)]"
                          : isRunning
                            ? "shadow-[0_1px_4px_rgba(0,0,0,0.2)]"
                            : "opacity-90 hover:opacity-100"
                      }`}
                      fallback={iconFallback}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side={isVertical ? (position === "left" ? "right" : "left") : "top"} sideOffset={8}>
                  {item.name}
                </TooltipContent>
              </Tooltip>
              {/* Always rendered to reserve space — invisible when not running */}
              <span
                className={`rounded-full transition-all duration-200 ${
                  isRunning
                    ? isFocused
                      ? "h-[3px] w-4 bg-primary"
                      : "h-[3px] w-2.5 bg-foreground/30"
                    : "invisible h-[3px] w-4"
                }`}
              />
            </div>
          );
        })}
      </nav>
    </div>
  );
}
