"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { OsIcon } from "@/components/icons/OsIcon";
import { APP_ICONS } from "@/components/icons/icon-assets";
import { DOCK_APPS } from "@/modules/shell/app-catalog";
import { useRef, useState } from "react";

type DockProps = {
  activeWindows?: string[];
  focusedWindow?: string | null;
  onItemClick?: (id: string) => void;
  position?: "bottom" | "left" | "right";
  animationsEnabled?: boolean;
  iconSize?: "small" | "medium" | "large";
};

/**
 * The dock follows the desktop icon setting.
 *
 * It used to be pinned at 44px while the grid moved between 48 and 72, so the
 * one control named "icon size" resized half the desktop and left the dock
 * behind — the larger the setting, the more the two disagreed. Medium keeps the
 * exact size the dock has always had, so the default is unchanged.
 *
 * Dock icons stay a little smaller than the grid's, the way a dock usually
 * reads against the desktop behind it.
 */
const DOCK_SIZING = {
  small: { button: "size-10", radius: "rounded-xl", glyph: "size-4", gap: "gap-2.5" },
  medium: { button: "size-11", radius: "rounded-2xl", glyph: "size-5", gap: "gap-3" },
  large: { button: "size-14", radius: "rounded-[1.25rem]", glyph: "size-6", gap: "gap-3.5" },
} as const;

export function Dock({
  activeWindows = [],
  focusedWindow = null,
  onItemClick,
  position = "bottom",
  animationsEnabled = true,
  iconSize = "medium",
}: DockProps) {
  const sizing = DOCK_SIZING[iconSize];
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const isVertical = position === "left" || position === "right";

  function getScale(index: number) {
    return hoveredIndex === index ? 1.18 : 1;
  }

  const dockPositionClass =
    position === "bottom"
      ? "fixed left-1/2 -translate-x-1/2"
      : position === "left"
        ? "fixed top-1/2 -translate-y-1/2"
        : "fixed top-1/2 -translate-y-1/2";

  // Keep the dock clear of the gesture bar and of a landscape notch. Every
  // inset resolves to 0 on a desktop browser, so this is the previous
  // bottom-4 / left-4 / right-4 spacing there.
  const dockPositionStyle =
    position === "bottom"
      ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }
      : position === "left"
        ? { left: "calc(env(safe-area-inset-left, 0px) + 1rem)" }
        : { right: "calc(env(safe-area-inset-right, 0px) + 1rem)" };

  return (
    <div className={`${dockPositionClass} z-50`} style={dockPositionStyle}>
      <nav
        ref={dockRef}
        className={`flex ${sizing.gap} border border-white/[0.09] rounded-[calc(var(--radius)+0.375rem)] shadow-2xl shadow-black/40 ${
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
        {DOCK_APPS.map((item, index) => {
          const scale = animationsEnabled ? getScale(index) : 1;
          const isRunning = activeWindows.includes(item.id);
          const isFocused = focusedWindow === item.id;
          const osSrc = APP_ICONS[item.id];

          const iconFallback = (
            <div
              className={`size-full ${sizing.radius} flex items-center justify-center ${item.iconBg}`}
            >
              <item.icon className={`${sizing.glyph} text-white`} />
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
                        ? "transform 0.16s ease-out"
                        : "none",
                    }}
                    className={`relative ${sizing.button} ${sizing.radius} overflow-hidden cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
                    aria-label={item.name}
                    aria-pressed={isFocused}
                  >
                    <OsIcon
                      src={osSrc}
                      alt={item.name}
                      className={`size-full ${sizing.radius} object-contain transition-[box-shadow] duration-150 ${
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
