"use client";

import { Plus } from "@/components/icons/platform-icons";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { normalizePathForBackend } from "@/modules/files/components/file-manager-presenters";
import { PeopleRegular, DeleteRegular } from "@fluentui/react-icons";
import { FILES_PANEL_SHELL } from "@/modules/files/components/file-manager-surface";
import type { ReactNode } from "react";

export type FileManagerSidebarItem = {
  name: string;
  icon: ReactNode;
  path: string[];
};

export type FileManagerSidebarSection = {
  title: string;
  items: FileManagerSidebarItem[];
};

type SidebarProps = {
  currentPath: string[];
  isSharedView: boolean;
  isTrashView: boolean;
  locationItems: FileManagerSidebarItem[];
  sidebarSections: FileManagerSidebarSection[];
  storageUsagePercent: number;
  storageUsageText: string;
  onNavigateToPath: (path: string[]) => void;
  onOpenNetworkDialog: () => void;
};

export function FileManagerSidebar({
  currentPath,
  isSharedView,
  isTrashView,
  locationItems,
  sidebarSections,
  storageUsagePercent,
  storageUsageText,
  onNavigateToPath,
  onOpenNetworkDialog,
}: SidebarProps) {
  const currentUserQuery = useCurrentUser();
  const isDemoMode = currentUserQuery.data?.isDemoMode ?? false;

  return (
    <aside className={`m-2 flex w-48 shrink-0 flex-col overflow-y-auto ${FILES_PANEL_SHELL}`}>
      <div className="flex flex-col gap-4 p-3 pt-4">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {section.title}
              </span>
              {section.title === "Locations" && !isDemoMode ? (
                <button
                  onClick={onOpenNetworkDialog}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                  title="Add network storage"
                  aria-label="Add network storage"
                >
                  <Plus className="size-3.5" />
                </button>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-col gap-0.5">
              {(section.title === "Locations" ? locationItems : section.items).map((item) => {
                const isActive =
                  JSON.stringify(normalizePathForBackend(item.path)) ===
                  JSON.stringify(currentPath);
                return (
                  <button
                    key={item.name}
                    onClick={() => onNavigateToPath(item.path)}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                      isActive
                        ? "bg-primary/15 text-foreground"
                        : "text-foreground/60 hover:text-foreground hover:bg-secondary/40"
                    }`}
                  >
                    {item.icon}
                    <span className="truncate">{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto border-t border-glass-border/80 p-3">
        <div className="mb-3 flex flex-col gap-0.5">
          <button
            onClick={() => onNavigateToPath(["Shared"])}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
              isSharedView
                ? "bg-primary/15 text-foreground"
                : "text-foreground/60 hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <PeopleRegular className="size-3.5 text-sky-400" />
            <span>Shared</span>
          </button>
          <button
            onClick={() => onNavigateToPath(["Trash"])}
            className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
              isTrashView
                ? "bg-primary/15 text-foreground"
                : "text-foreground/60 hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <DeleteRegular className="size-3.5 text-status-red" />
            <span>Trash</span>
          </button>
        </div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Storage</span>
          <span className="text-xs text-muted-foreground">{storageUsageText}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-lg bg-background/65">
          <div
            className="h-full rounded-lg bg-primary"
            style={{ width: `${storageUsagePercent}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
