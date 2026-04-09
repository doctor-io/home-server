"use client";

import {
  DeleteRegular,
  PeopleRegular,
} from "@fluentui/react-icons";
import { normalizePathForBackend } from "@/modules/files/components/file-manager-presenters";
import {
  FILES_BADGE_SURFACE,
  FILES_PANEL_SHELL,
} from "@/modules/files/components/file-manager-surface";
import {
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  File,
  Folder,
  Globe,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  SortAsc,
  SortDesc,
  Upload,
} from "@/components/icons/platform-icons";
import type { ReactNode, RefObject } from "react";

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
  return (
    <aside className={`m-2 flex w-48 shrink-0 flex-col overflow-y-auto ${FILES_PANEL_SHELL}`}>
      <div className="flex flex-col gap-4 p-3 pt-4">
        {sidebarSections.map((section) => (
          <div key={section.title}>
            <div className="flex items-center justify-between px-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                {section.title}
              </span>
              {section.title === "Locations" ? (
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
              {(section.title === "Locations"
                ? locationItems
                : section.items
              ).map((item) => {
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
          <span className="text-xs text-muted-foreground">
            {storageUsageText}
          </span>
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

type ToolbarProps = {
  canNavigateUp: boolean;
  createFilePending: boolean;
  createFolderPending: boolean;
  currentEntriesCount: number;
  currentPath: string[];
  currentPathForDisplay: string[];
  emptyTrashPending: boolean;
  globalSearch: boolean;
  globalSearchIsFetching: boolean;
  includeHidden: boolean;
  isEmptyingTrash: boolean;
  isStarredView: boolean;
  isTrashView: boolean;
  rootLabel: string;
  searchQuery: string;
  sortBy: "name" | "modified" | "size";
  sortDir: "asc" | "desc";
  uploadFilesPending: boolean;
  uploadInputRef: RefObject<HTMLInputElement | null>;
  uploadProgress: { loaded: number; total: number } | null;
  viewMode: "grid" | "list";
  onCycleSortBy: () => void;
  onEmptyTrash: () => void;
  onNavigateToPath: (path: string[]) => void;
  onNavigateUp: () => void;
  onOpenCreateEntryDialog: (kind: "file" | "folder") => void;
  onSearchQueryChange: (value: string) => void;
  onSetViewMode: (mode: "grid" | "list") => void;
  onToggleGlobalSearch: () => void;
  onToggleIncludeHidden: () => void;
  onToggleSortDir: () => void;
  onUploadInputChange: (files: File[]) => void;
};

export function FileManagerToolbar({
  canNavigateUp,
  createFilePending,
  createFolderPending,
  currentEntriesCount,
  currentPath,
  currentPathForDisplay,
  emptyTrashPending,
  globalSearch,
  globalSearchIsFetching,
  includeHidden,
  isEmptyingTrash,
  isStarredView,
  isTrashView,
  rootLabel,
  searchQuery,
  sortBy,
  sortDir,
  uploadFilesPending,
  uploadInputRef,
  uploadProgress,
  viewMode,
  onCycleSortBy,
  onEmptyTrash,
  onNavigateToPath,
  onNavigateUp,
  onOpenCreateEntryDialog,
  onSearchQueryChange,
  onSetViewMode,
  onToggleGlobalSearch,
  onToggleIncludeHidden,
  onToggleSortDir,
  onUploadInputChange,
}: ToolbarProps) {
  return (
    <div className={`flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-glass-border/80 px-3 py-2 ${FILES_PANEL_SHELL}`}>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onNavigateUp}
          disabled={!canNavigateUp}
          className="p-1.5 rounded-lg hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
          aria-label="Go up one level"
        >
          <ArrowUp className="size-3.5 text-muted-foreground" />
        </button>
      </div>

      <nav
        className="flex min-w-0 flex-1 items-center gap-1"
        aria-label="File path"
      >
        <button
          onClick={() => onNavigateToPath([])}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary/40 cursor-pointer shrink-0"
        >
          <span className="inline-flex items-center gap-1">
            <HardDrive className="size-3.5" />
            <span className="hidden 2xl:inline">{rootLabel}</span>
          </span>
        </button>
        {currentPath.map((segment, index) => (
          <div
            key={segment + index}
            className="flex min-w-0 items-center gap-1"
          >
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
            <button
              onClick={() => onNavigateToPath(currentPath.slice(0, index + 1))}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary/40 truncate max-w-24 sm:max-w-28 md:max-w-32 cursor-pointer"
            >
              {currentPathForDisplay[index] ?? segment}
            </button>
          </div>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-1">
        {!isTrashView && !isStarredView ? (
          <>
            <button
              onClick={() => onOpenCreateEntryDialog("folder")}
              disabled={createFolderPending}
              className="relative inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="New folder"
              title="New folder"
            >
              <Folder className="size-3.5" />
              <Plus className="absolute -right-0.5 -top-0.5 size-2.5" />
            </button>
            <button
              onClick={() => onOpenCreateEntryDialog("file")}
              disabled={createFilePending}
              className="relative inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="New file"
              title="New file"
            >
              <File className="size-3.5" />
              <Plus className="absolute -right-0.5 -top-0.5 size-2.5" />
            </button>
            <div className="relative inline-flex items-center">
              <button
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadFilesPending}
                className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Upload files"
                title="Upload files"
              >
                {uploadFilesPending && uploadProgress ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : (
                  <Upload className="size-3.5" />
                )}
              </button>
              {uploadProgress && uploadProgress.total > 0 ? (
                <div
                  className="absolute -bottom-1 left-0 right-0 h-0.5 overflow-hidden rounded-full bg-white/10"
                  title={`${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%`}
                >
                  <div
                    className="h-full bg-primary transition-all duration-150"
                    style={{ width: `${Math.min(100, Math.round((uploadProgress.loaded / uploadProgress.total) * 100))}%` }}
                  />
                </div>
              ) : null}
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                onUploadInputChange(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="relative w-36">
          {globalSearchIsFetching ? (
            <Loader2 className="absolute left-2 top-1/2 size-3 -translate-y-1/2 animate-spin text-primary" />
          ) : (
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={globalSearch ? "Search everywhere..." : "Search..."}
            className={`h-7 w-full rounded-lg border pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-secondary/60 transition-all ${
              globalSearch
              ? "border-primary/40 bg-background/60 focus:border-primary/60"
                : "border-glass-border bg-background/55 focus:border-primary/40"
            }`}
          />
        </div>
        <button
          onClick={onToggleGlobalSearch}
          className={`inline-flex size-7 items-center justify-center rounded-lg text-xs transition-colors cursor-pointer ${
            globalSearch
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
          }`}
          title={
            globalSearch
              ? "Switch to local search"
              : "Search everywhere (recursive)"
          }
        >
          <Globe className="size-3.5" />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isTrashView ? (
          <button
            onClick={onEmptyTrash}
            disabled={
              isEmptyingTrash || emptyTrashPending || currentEntriesCount === 0
            }
            className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-status-red/10 text-xs text-status-red transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            title="Permanently delete all items in Trash"
          >
            <DeleteRegular className="size-3.5" />
            <span className="hidden xl:inline">Empty Trash</span>
          </button>
        ) : null}
        <button
          onClick={onToggleIncludeHidden}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer"
          title={includeHidden ? "Hide hidden files" : "Show hidden files"}
        >
          {includeHidden ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
        </button>
        <button
          onClick={onCycleSortBy}
          className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer"
          title={`Sort by: ${sortBy} (click to change field)`}
        >
          <span className="hidden xl:inline capitalize">{sortBy}</span>
        </button>
        <button
          onClick={onToggleSortDir}
          className="flex items-center rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary/50 cursor-pointer"
          title={
            sortDir === "asc"
              ? "Ascending - click to reverse"
              : "Descending - click to reverse"
          }
        >
          {sortDir === "asc" ? (
            <SortAsc className="size-3" />
          ) : (
            <SortDesc className="size-3" />
          )}
        </button>
      </div>

      <div className="flex shrink-0 items-center rounded-lg bg-background/55 p-0.5">
        <button
          onClick={() => onSetViewMode("grid")}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            viewMode === "grid"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Grid view"
        >
          <LayoutGrid className="size-3.5" />
        </button>
        <button
          onClick={() => onSetViewMode("list")}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            viewMode === "list"
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label="List view"
        >
          <List className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

type StatusBarProps = {
  clipboardName: string | null;
  clipboardOperation: "copy" | "move" | null;
  currentPathForDisplay: string[];
  fileCount: number;
  folderCount: number;
  isStarredView: boolean;
  isTrashView: boolean;
  rootLabel: string;
  selectedFilesCount: number;
  statusNotice: string | null;
  onTrashSelected: () => void;
};

export function FileManagerStatusBar({
  clipboardName,
  clipboardOperation,
  currentPathForDisplay,
  fileCount,
  folderCount,
  isStarredView,
  isTrashView,
  rootLabel,
  selectedFilesCount,
  statusNotice,
  onTrashSelected,
}: StatusBarProps) {
  return (
    <div className="flex items-center justify-between border-t border-glass-border/80 bg-background/48 px-3 py-1.5 text-xs text-muted-foreground">
      <span className="flex items-center gap-3">
        <span>
          {folderCount > 0 &&
            `${folderCount} folder${folderCount > 1 ? "s" : ""}`}
          {folderCount > 0 && fileCount > 0 ? ", " : ""}
          {fileCount > 0 && `${fileCount} file${fileCount > 1 ? "s" : ""}`}
        </span>
        {selectedFilesCount > 1 ? (
          <span className="flex items-center gap-1.5 text-primary">
            <span>{selectedFilesCount} selected</span>
            {!isTrashView && !isStarredView ? (
              <button
                onClick={onTrashSelected}
                className={`flex items-center gap-1 px-1.5 py-0.5 text-status-red transition-colors hover:bg-status-red/20 cursor-pointer ${FILES_BADGE_SURFACE}`}
                title="Move selected to Trash"
              >
                <DeleteRegular className="size-3" />
                <span>Trash selected</span>
              </button>
            ) : null}
          </span>
        ) : null}
      </span>

      <div className="flex items-center gap-3">
        {statusNotice ? (
          <span className="max-w-72 truncate text-status-amber">
            {statusNotice}
          </span>
        ) : null}
        {clipboardName && clipboardOperation ? (
          <span className="max-w-56 truncate text-muted-foreground">
            {clipboardOperation === "copy" ? "Clipboard" : "Cut"}:{" "}
            {clipboardName}
          </span>
        ) : null}
        <span className="font-mono">
          {rootLabel}
          {currentPathForDisplay.length > 0
            ? `/${currentPathForDisplay.join("/")}`
            : ""}
        </span>
      </div>
    </div>
  );
}
