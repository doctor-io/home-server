"use client";

import {
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SortAsc,
  SortDesc,
  Upload,
} from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";
import { FILES_PANEL_SHELL } from "@/modules/files/components/file-manager-surface";
import { DeleteRegular } from "@fluentui/react-icons";
import type { RefObject } from "react";

type ToolbarProps = {
  canNavigateUp: boolean;
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
  onSearchQueryChange: (value: string) => void;
  onSetViewMode: (mode: "grid" | "list") => void;
  onToggleGlobalSearch: () => void;
  onToggleIncludeHidden: () => void;
  onToggleSortDir: () => void;
  onUploadInputChange: (files: File[]) => void;
};

const iconBtn = "inline-flex size-7 items-center justify-center rounded-lg transition-colors";
const iconBtnIdle = "text-muted-foreground hover:bg-background/50 hover:text-foreground";

export function FileManagerToolbar({
  canNavigateUp,
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
  onSearchQueryChange,
  onSetViewMode,
  onToggleGlobalSearch,
  onToggleIncludeHidden,
  onToggleSortDir,
  onUploadInputChange,
}: ToolbarProps) {
  return (
    <div className={cn("flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-glass-border/60 px-3 py-2", FILES_PANEL_SHELL)}>

      {/* Back / up */}
      <button
        onClick={onNavigateUp}
        disabled={!canNavigateUp}
        aria-label="Go up one level"
        className={cn(iconBtn, iconBtnIdle, "disabled:cursor-not-allowed disabled:opacity-30")}
      >
        <ArrowUp className="size-3.5" />
      </button>

      {/* Breadcrumb */}
      <nav className="flex min-w-0 flex-1 items-center gap-0.5" aria-label="File path">
        <button
          onClick={() => onNavigateToPath([])}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
        >
          <HardDrive className="size-4" />
          <span className="hidden 2xl:inline">{rootLabel}</span>
        </button>
        {currentPath.map((segment, index) => (
          <div key={segment + index} className="flex min-w-0 items-center gap-0.5">
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
            <button
              onClick={() => onNavigateToPath(currentPath.slice(0, index + 1))}
              className="max-w-24 truncate rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground sm:max-w-28 md:max-w-32"
            >
              {currentPathForDisplay[index] ?? segment}
            </button>
          </div>
        ))}
      </nav>

      {/* Upload */}
      {!isTrashView && !isStarredView && (
        <div className="relative">
          <button
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploadFilesPending}
            aria-label="Upload files"
            title="Upload files"
            className={cn(iconBtn, iconBtnIdle, "disabled:cursor-not-allowed disabled:opacity-50")}
          >
            {uploadFilesPending && uploadProgress ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <Upload className="size-3.5" />
            )}
          </button>
          {uploadProgress && uploadProgress.total > 0 && (
            <div
              className="absolute -bottom-1 left-0 right-0 h-0.5 overflow-hidden rounded-full bg-white/10"
              title={`${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%`}
            >
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${Math.min(100, Math.round((uploadProgress.loaded / uploadProgress.total) * 100))}%` }}
              />
            </div>
          )}
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              onUploadInputChange(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
      )}

      {/* Search */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="relative w-36">
          {globalSearchIsFetching ? (
            <Loader2 className="absolute left-2 top-1/2 size-3 -translate-y-1/2 animate-spin text-primary" />
          ) : (
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/60" />
          )}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={globalSearch ? "Search everywhere…" : "Search…"}
            className={cn(
              "h-7 w-full rounded-lg border pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-all",
              globalSearch
                ? "border-primary/40 bg-background/60 focus:border-primary/60"
                : "border-glass-border bg-background/55 focus:border-primary/40",
            )}
          />
        </div>
        <button
          onClick={onToggleGlobalSearch}
          title={globalSearch ? "Switch to local search" : "Search everywhere"}
          className={cn(
            iconBtn,
            globalSearch ? "bg-primary/15 text-primary hover:bg-primary/20" : iconBtnIdle,
          )}
        >
          <Globe className="size-3.5" />
        </button>
      </div>

      {/* Sort + visibility */}
      <div className="flex shrink-0 items-center gap-1">
        {isTrashView && (
          <button
            onClick={onEmptyTrash}
            disabled={isEmptyingTrash || emptyTrashPending || currentEntriesCount === 0}
            title="Permanently delete all items in Trash"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-status-red transition-colors hover:bg-status-red/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <DeleteRegular className="size-3.5" />
            <span className="hidden xl:inline">Empty Trash</span>
          </button>
        )}
        <button
          onClick={onToggleIncludeHidden}
          title={includeHidden ? "Hide hidden files" : "Show hidden files"}
          className={cn(iconBtn, iconBtnIdle)}
        >
          {includeHidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
        <button
          onClick={onCycleSortBy}
          title={`Sort by: ${sortBy} (click to change)`}
          className="rounded-lg px-2 py-1 text-xs capitalize text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
        >
          <span className="hidden xl:inline">{sortBy}</span>
        </button>
        <button
          onClick={onToggleSortDir}
          title={sortDir === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
          className={cn(iconBtn, iconBtnIdle)}
        >
          {sortDir === "asc" ? <SortAsc className="size-3.5" /> : <SortDesc className="size-3.5" />}
        </button>
      </div>

      {/* View mode toggle */}
      <div className="flex shrink-0 items-center rounded-lg border border-glass-border/60 bg-background/40 p-0.5">
        <button
          onClick={() => onSetViewMode("grid")}
          aria-label="Grid view"
          className={cn(
            "rounded-md p-1 transition-colors",
            viewMode === "grid" ? "bg-primary/15 text-primary" : iconBtnIdle,
          )}
        >
          <LayoutGrid className="size-3.5" />
        </button>
        <button
          onClick={() => onSetViewMode("list")}
          aria-label="List view"
          className={cn(
            "rounded-md p-1 transition-colors",
            viewMode === "list" ? "bg-primary/15 text-primary" : iconBtnIdle,
          )}
        >
          <List className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
