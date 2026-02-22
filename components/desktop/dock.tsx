"use client";

import {
  Activity,
  FolderOpen,
  LayoutGrid,
  Plus,
  Settings,
  ShoppingBag,
  Terminal
} from "lucide-react";
import { useRef, useState } from "react";

export type DockItemDef = {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const dockItemDefs: DockItemDef[] = [
  { id: "apps", name: "Apps", icon: LayoutGrid },
  { id: "terminal", name: "Terminal", icon: Terminal },
  { id: "files", name: "Files", icon: FolderOpen },
  { id: "monitor", name: "Monitor", icon: Activity },
  // { id: "firewall", name: "Firewall", icon: Shield },
  // { id: "browser", name: "Browser", icon: Globe },
  { id: "app-store", name: "App Store", icon: ShoppingBag },
  { id: "settings", name: "Settings", icon: Settings },
];

type DockProps = {
  activeWindows?: string[];
  onItemClick?: (id: string) => void;
};

export function Dock({ activeWindows = [], onItemClick }: DockProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  function getScale(index: number) {
    if (hoveredIndex === null) return 1;
    const distance = Math.abs(index - hoveredIndex);
    if (distance === 0) return 1.35;
    if (distance === 1) return 1.15;
    if (distance === 2) return 1.05;
    return 1;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <nav
        ref={dockRef}
        className="flex items-end gap-1.5 px-3 py-2.5 bg-dock backdrop-blur-2xl border border-glass-border rounded-2xl shadow-2xl shadow-black/40"
        onMouseLeave={() => setHoveredIndex(null)}
        aria-label="Quick launch dock"
      >
        {dockItemDefs.map((item, index) => {
          const scale = getScale(index);
          const isActive = activeWindows.includes(item.id);
          return (
            <div key={item.id} className="flex flex-col items-center gap-1">
              <button
                onMouseEnter={() => setHoveredIndex(index)}
                onClick={() => onItemClick?.(item.id)}
                style={{
                  transform: `scale(${scale})`,
                  transition:
                    "transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                }}
                className={`relative size-11 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                }`}
                aria-label={item.name}
              >
                <item.icon className="size-5" />
                {hoveredIndex === index && (
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 text-[11px] font-medium text-foreground bg-popover border border-glass-border rounded-lg whitespace-nowrap shadow-lg">
                    {item.name}
                  </span>
                )}
              </button>
              {isActive && <span className="size-1 rounded-full bg-primary" />}
            </div>
          );
        })}

        {/* Separator */}
        <div className="w-px h-8 bg-border mx-1" />

        {/* Add button */}
        <div className="flex flex-col items-center gap-1">
          <button
            onMouseEnter={() => setHoveredIndex(dockItemDefs.length)}
            className="size-11 rounded-xl flex items-center justify-center cursor-pointer bg-glass-highlight border border-dashed border-glass-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
            aria-label="Add to dock"
            style={{
              transform: `scale(${getScale(dockItemDefs.length)})`,
              transition: "transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            <Plus className="size-4" />
          </button>
        </div>
      </nav>
    </div>
  );
}
