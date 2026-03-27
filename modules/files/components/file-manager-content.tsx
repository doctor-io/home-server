"use client";

import {
  getFileIcon,
  getLargeFileIcon,
  type FileEntry,
} from "@/modules/files/components/file-manager-presenters";
import {
  FILES_BADGE_SURFACE,
  FILES_PANEL_INSET,
} from "@/modules/files/components/file-manager-surface";
import { MonacoEditorPane } from "@/modules/files/components/file-manager-editor-pane";
import type { FileReadResponse } from "@/lib/shared/contracts/files";
import { FolderOpen, Loader2, Save, Star, Upload, X } from "@/components/icons/platform-icons";
import type { DragEventHandler, MouseEvent, ReactNode, SetStateAction } from "react";

type FileManagerFileAreaProps = {
  canSaveOpenFile: boolean;
  directoryErrorMessage: string;
  directoryIsError: boolean;
  directoryIsLoading: boolean;
  editorNotice: string | null;
  fileContentErrorMessage: string;
  fileContentIsError: boolean;
  fileContentIsLoading: boolean;
  isDragOver: boolean;
  isGlobalSearchActive: boolean;
  isStarredView: boolean;
  isTrashView: boolean;
  openFile: { entry: FileEntry } | null;
  openFileAssetUrl: string;
  openFileBadgeLabel: string;
  openFileContent: string;
  openFileKey: string | null;
  openFileLanguage: string;
  openFileViewer: FileReadResponse | null;
  pendingEntryPath: string | null;
  searchQuery: string;
  selectedFiles: Set<string>;
  sortedEntries: FileEntry[];
  viewMode: "grid" | "list";
  globalSearchIsFetching: boolean;
  onChangeOpenFileDraft: (value: SetStateAction<string>) => void;
  onCloseOpenFile: () => void;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onEntryClick: (event: MouseEvent, entry: FileEntry) => void;
  onEntryContextMenu: (event: MouseEvent, entry: FileEntry) => void;
  onOpenEntry: (entry: FileEntry) => void;
  onSaveOpenFile: () => void;
};

export function FileManagerFileArea({
  canSaveOpenFile,
  directoryErrorMessage,
  directoryIsError,
  directoryIsLoading,
  editorNotice,
  fileContentErrorMessage,
  fileContentIsError,
  fileContentIsLoading,
  globalSearchIsFetching,
  isDragOver,
  isGlobalSearchActive,
  isStarredView,
  isTrashView,
  onChangeOpenFileDraft,
  onCloseOpenFile,
  onDragLeave,
  onDragOver,
  onDrop,
  onEntryClick,
  onEntryContextMenu,
  onOpenEntry,
  onSaveOpenFile,
  openFile,
  openFileAssetUrl,
  openFileBadgeLabel,
  openFileContent,
  openFileKey,
  openFileLanguage,
  openFileViewer,
  pendingEntryPath,
  searchQuery,
  selectedFiles,
  sortedEntries,
  viewMode,
}: FileManagerFileAreaProps) {
  return (
    <div
      className="relative flex-1 overflow-y-auto p-3"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragOver && !isTrashView && !isStarredView ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 pointer-events-none">
          <Upload className="mb-2 size-8 text-primary/70" />
          <span className="text-sm font-medium text-primary/80">
            Drop files to upload
          </span>
        </div>
      ) : null}

      {openFile ? (
        <OpenFileView
          canSaveOpenFile={canSaveOpenFile}
          editorNotice={editorNotice}
          fileContentErrorMessage={fileContentErrorMessage}
          fileContentIsError={fileContentIsError}
          fileContentIsLoading={fileContentIsLoading}
          onChangeOpenFileDraft={onChangeOpenFileDraft}
          onClose={onCloseOpenFile}
          onSave={onSaveOpenFile}
          openFile={openFile}
          openFileAssetUrl={openFileAssetUrl}
          openFileBadgeLabel={openFileBadgeLabel}
          openFileContent={openFileContent}
          openFileKey={openFileKey}
          openFileLanguage={openFileLanguage}
          openFileViewer={openFileViewer}
        />
      ) : directoryIsLoading ? (
        <CenteredState
          icon={<FolderOpen className="size-12 opacity-30" />}
          label="Loading files..."
        />
      ) : directoryIsError ? (
        <CenteredState
          icon={<FolderOpen className="size-12 opacity-50" />}
          label={directoryErrorMessage}
          tone="error"
        />
      ) : sortedEntries.length === 0 ? (
        <CenteredState
          icon={
            isGlobalSearchActive && globalSearchIsFetching ? (
              <Loader2 className="size-10 animate-spin opacity-40" />
            ) : (
              <FolderOpen className="size-12 opacity-30" />
            )
          }
          label={
            isGlobalSearchActive
              ? globalSearchIsFetching
                ? "Searching..."
                : "No results found"
              : searchQuery
                ? "No matching files found"
                : "This folder is empty"
          }
        />
      ) : viewMode === "grid" ? (
        <FileGrid
          entries={sortedEntries}
          pendingEntryPath={pendingEntryPath}
          selectedFiles={selectedFiles}
          titleFromPath={isGlobalSearchActive}
          onEntryClick={onEntryClick}
          onEntryContextMenu={onEntryContextMenu}
          onOpenEntry={onOpenEntry}
        />
      ) : (
        <FileList
          entries={sortedEntries}
          isGlobalSearchActive={isGlobalSearchActive}
          isTrashView={isTrashView}
          pendingEntryPath={pendingEntryPath}
          selectedFiles={selectedFiles}
          onEntryClick={onEntryClick}
          onEntryContextMenu={onEntryContextMenu}
          onOpenEntry={onOpenEntry}
        />
      )}
    </div>
  );
}

function OpenFileView({
  canSaveOpenFile,
  editorNotice,
  fileContentErrorMessage,
  fileContentIsError,
  fileContentIsLoading,
  onChangeOpenFileDraft,
  onClose,
  onSave,
  openFile,
  openFileAssetUrl,
  openFileBadgeLabel,
  openFileContent,
  openFileKey,
  openFileLanguage,
  openFileViewer,
}: {
  canSaveOpenFile: boolean;
  editorNotice: string | null;
  fileContentErrorMessage: string;
  fileContentIsError: boolean;
  fileContentIsLoading: boolean;
  onChangeOpenFileDraft: (value: SetStateAction<string>) => void;
  onClose: () => void;
  onSave: () => void;
  openFile: { entry: FileEntry };
  openFileAssetUrl: string;
  openFileBadgeLabel: string;
  openFileContent: string;
  openFileKey: string | null;
  openFileLanguage: string;
  openFileViewer: FileReadResponse | null;
}) {
  return (
    <div className={`flex h-full flex-col overflow-hidden ${FILES_PANEL_INSET}`}>
      <div className="flex items-center gap-2 border-b border-glass-border/80 bg-background/52 px-3 py-2">
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
        >
          Back to files
        </button>
        <div className="h-4 w-px bg-border" />
        <div className="flex min-w-0 items-center gap-2">
          {getFileIcon(openFile.entry)}
          <span className="truncate text-xs font-medium text-foreground">
            {openFile.entry.name}
          </span>
          <span className={`${FILES_BADGE_SURFACE} px-1.5 py-0.5 text-xs uppercase tracking-wider text-primary`}>
            {openFileBadgeLabel}
          </span>
        </div>
        <div className="flex-1" />
        <button
          onClick={onSave}
          disabled={!canSaveOpenFile}
          className="flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="size-3" /> Save
        </button>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          aria-label="Close editor"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {fileContentIsLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading file...
          </div>
        ) : fileContentIsError ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-status-red">
            {fileContentErrorMessage}
          </div>
        ) : openFileViewer?.mode === "text" ? (
          <MonacoEditorPane
            key={openFileKey ?? "editor"}
            language={openFileLanguage}
            value={openFileContent}
            onChange={(value) => onChangeOpenFileDraft(value)}
          />
        ) : openFileViewer?.mode === "image" ? (
          <div className="flex h-full items-center justify-center overflow-auto bg-background/50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={openFileAssetUrl}
              alt={openFile.entry.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : openFileViewer?.mode === "pdf" ? (
          <iframe
            title={openFile.entry.name}
            src={openFileAssetUrl}
            className="h-full w-full border-0 bg-background/50"
          />
        ) : openFileViewer?.mode === "video" ? (
          <div className="flex h-full items-center justify-center overflow-auto bg-black/95 p-4">
            <video
              key={openFileAssetUrl}
              src={openFileAssetUrl}
              controls
              className="max-h-full max-w-full"
              style={{ outline: "none" }}
            />
          </div>
        ) : openFileViewer?.mode === "too_large" ? (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            This file is too large to open in the editor.
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
            This file type is not supported for in-app preview.
          </div>
        )}
      </div>

      {editorNotice ? (
        <div className="border-t border-glass-border px-3 py-2 text-xs text-muted-foreground">
          {editorNotice}
        </div>
      ) : null}
    </div>
  );
}

function FileGrid({
  entries,
  pendingEntryPath,
  selectedFiles,
  titleFromPath,
  onEntryClick,
  onEntryContextMenu,
  onOpenEntry,
}: {
  entries: FileEntry[];
  pendingEntryPath: string | null;
  selectedFiles: Set<string>;
  titleFromPath: boolean;
  onEntryClick: (event: MouseEvent, entry: FileEntry) => void;
  onEntryContextMenu: (event: MouseEvent, entry: FileEntry) => void;
  onOpenEntry: (entry: FileEntry) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {entries.map((entry) => (
        <button
          key={entry.name}
          title={titleFromPath ? entry.path : entry.name}
          onClick={(event) => onEntryClick(event, entry)}
          onDoubleClick={() => onOpenEntry(entry)}
          onContextMenu={(event) => onEntryContextMenu(event, entry)}
          className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-all cursor-pointer ${
            selectedFiles.has(entry.name)
              ? "border border-primary/30 bg-primary/15"
              : "border border-transparent hover:bg-secondary/40"
          }`}
        >
          <div className="relative">
            {pendingEntryPath === entry.path ? (
              <div className="flex size-10 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : (
              getLargeFileIcon(entry)
            )}
            {entry.starred && pendingEntryPath !== entry.path ? (
              <Star className="absolute -right-1 -top-1 size-3 fill-amber-400 text-amber-400" />
            ) : null}
          </div>
          <div className="flex w-full flex-col items-center gap-0.5">
            <span className="line-clamp-2 break-all text-center text-xs font-medium leading-tight text-foreground">
              {entry.name}
            </span>
            {entry.size ? (
              <span className="text-xs text-muted-foreground">{entry.size}</span>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  );
}

function FileList({
  entries,
  isGlobalSearchActive,
  isTrashView,
  pendingEntryPath,
  selectedFiles,
  onEntryClick,
  onEntryContextMenu,
  onOpenEntry,
}: {
  entries: FileEntry[];
  isGlobalSearchActive: boolean;
  isTrashView: boolean;
  pendingEntryPath: string | null;
  selectedFiles: Set<string>;
  onEntryClick: (event: MouseEvent, entry: FileEntry) => void;
  onEntryContextMenu: (event: MouseEvent, entry: FileEntry) => void;
  onOpenEntry: (entry: FileEntry) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-glass-border/80 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="min-w-0 flex-1">Name</span>
        {isTrashView ? (
          <span className="hidden w-48 text-right lg:block">Original Location</span>
        ) : null}
        {isGlobalSearchActive ? (
          <span className="hidden w-48 text-right lg:block">Location</span>
        ) : null}
        <span className="hidden w-20 text-right sm:block">Size</span>
        <span className="hidden w-32 text-right md:block">
          {isTrashView ? "Deleted" : "Modified"}
        </span>
      </div>

      {entries.map((entry) => (
        <button
          key={entry.name}
          onClick={(event) => onEntryClick(event, entry)}
          onDoubleClick={() => onOpenEntry(entry)}
          onContextMenu={(event) => onEntryContextMenu(event, entry)}
          className={`flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
            selectedFiles.has(entry.name) ? "bg-primary/15" : "hover:bg-secondary/30"
          }`}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {pendingEntryPath === entry.path ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              getFileIcon(entry)
            )}
            <span className="truncate text-xs text-foreground">{entry.name}</span>
            {entry.starred && pendingEntryPath !== entry.path ? (
              <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
            ) : null}
          </div>

          {isTrashView ? (
            <span
              className="hidden w-48 shrink-0 truncate text-right text-xs text-muted-foreground lg:block"
              title={entry.trashOriginalPath}
            >
              {entry.trashOriginalPath ?? "—"}
            </span>
          ) : null}

          {isGlobalSearchActive ? (
            <span
              className="hidden w-48 shrink-0 truncate text-right text-xs text-muted-foreground lg:block"
              title={entry.path}
            >
              {entry.path.includes("/")
                ? entry.path.slice(0, entry.path.lastIndexOf("/"))
                : "/"}
            </span>
          ) : null}

          <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">
            {entry.type === "folder" ? "—" : (entry.size ?? "0 B")}
          </span>
          <span className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground md:block">
            {isTrashView
              ? entry.trashDeletedAt
                ? new Date(entry.trashDeletedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"
              : entry.modified}
          </span>
        </button>
      ))}
    </div>
  );
}

function CenteredState({
  icon,
  label,
  tone = "muted",
}: {
  icon: ReactNode;
  label: string;
  tone?: "muted" | "error";
}) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-3 ${
        tone === "error" ? "text-status-red" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-center text-sm">
        {label}
      </span>
    </div>
  );
}
