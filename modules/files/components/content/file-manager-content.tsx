"use client";

import { FolderOpen, Loader2, Upload } from "@/components/icons/platform-icons";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  FileGrid,
  FileList,
  LoadMoreBanner,
} from "@/modules/files/components/content/file-manager-entry-views";
import { OpenFileDialog } from "@/modules/files/components/content/file-manager-open-file-dialog";
import type { FileEntry } from "@/modules/files/components/file-manager-presenters";
import type { FileReadResponse } from "@/lib/shared/contracts/files";
import type { DragEventHandler, MouseEvent, SetStateAction } from "react";

type FileManagerFileAreaProps = {
  canSaveOpenFile: boolean;
  directoryErrorMessage: string;
  directoryIsError: boolean;
  directoryIsLoading: boolean;
  editorNotice: string | null;
  fileContentErrorMessage: string;
  fileContentIsError: boolean;
  fileContentIsLoading: boolean;
  globalSearchIsFetching: boolean;
  hasMoreSearchResults: boolean;
  hasUnsavedChanges: boolean;
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
  showSaveOpenFile: boolean;
  pendingEntryPath: string | null;
  searchQuery: string;
  selectedFiles: Set<string>;
  sortedEntries: FileEntry[];
  totalEntriesCount: number;
  viewMode: "grid" | "list";
  onBackgroundContextMenu: (event: MouseEvent) => void;
  onChangeOpenFileDraft: (value: SetStateAction<string>) => void;
  onCloseOpenFile: () => void;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onEntryClick: (event: MouseEvent, entry: FileEntry) => void;
  onEntryContextMenu: (event: MouseEvent, entry: FileEntry) => void;
  onLoadMoreSearch: () => void;
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
  hasMoreSearchResults,
  hasUnsavedChanges,
  isDragOver,
  isGlobalSearchActive,
  isStarredView,
  isTrashView,
  onBackgroundContextMenu,
  onChangeOpenFileDraft,
  onCloseOpenFile,
  onDragLeave,
  onDragOver,
  onDrop,
  onEntryClick,
  onEntryContextMenu,
  onLoadMoreSearch,
  onOpenEntry,
  onSaveOpenFile,
  openFile,
  openFileAssetUrl,
  openFileBadgeLabel,
  openFileContent,
  openFileKey,
  openFileLanguage,
  openFileViewer,
  showSaveOpenFile,
  pendingEntryPath,
  searchQuery,
  selectedFiles,
  sortedEntries,
  totalEntriesCount,
  viewMode,
}: FileManagerFileAreaProps) {
  return (
    <div
      className="relative flex-1 overflow-y-auto p-3"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={!openFile && !isTrashView && !isStarredView ? onBackgroundContextMenu : undefined}
    >
      {isDragOver && !isTrashView && !isStarredView ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 pointer-events-none">
          <Upload className="mb-2 size-8 text-primary/70" />
          <span className="text-sm font-medium text-primary/80">Drop files to upload</span>
        </div>
      ) : null}

      {renderBrowserState({
        directoryErrorMessage,
        directoryIsError,
        directoryIsLoading,
        globalSearchIsFetching,
        hasMoreSearchResults,
        isGlobalSearchActive,
        isTrashView,
        onEntryClick,
        onEntryContextMenu,
        onLoadMoreSearch,
        onOpenEntry,
        pendingEntryPath,
        searchQuery,
        selectedFiles,
        sortedEntries,
        totalEntriesCount,
        viewMode,
      })}

      {openFile ? (
        <OpenFileDialog
          canSaveOpenFile={canSaveOpenFile}
          editorNotice={editorNotice}
          fileContentErrorMessage={fileContentErrorMessage}
          fileContentIsError={fileContentIsError}
          fileContentIsLoading={fileContentIsLoading}
          hasUnsavedChanges={hasUnsavedChanges}
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
          showSaveOpenFile={showSaveOpenFile}
        />
      ) : null}
    </div>
  );
}

function renderBrowserState({
  directoryErrorMessage,
  directoryIsError,
  directoryIsLoading,
  globalSearchIsFetching,
  hasMoreSearchResults,
  isGlobalSearchActive,
  isTrashView,
  onEntryClick,
  onEntryContextMenu,
  onLoadMoreSearch,
  onOpenEntry,
  pendingEntryPath,
  searchQuery,
  selectedFiles,
  sortedEntries,
  totalEntriesCount,
  viewMode,
}: Omit<
  FileManagerFileAreaProps,
  | "canSaveOpenFile"
  | "editorNotice"
  | "fileContentErrorMessage"
  | "fileContentIsError"
  | "fileContentIsLoading"
  | "hasUnsavedChanges"
  | "isDragOver"
  | "isStarredView"
  | "openFile"
  | "openFileAssetUrl"
  | "openFileBadgeLabel"
  | "openFileContent"
  | "openFileKey"
  | "openFileLanguage"
  | "openFileViewer"
  | "showSaveOpenFile"
  | "onBackgroundContextMenu"
  | "onChangeOpenFileDraft"
  | "onCloseOpenFile"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "onSaveOpenFile"
>) {
  if (directoryIsLoading) {
    return (
      <Empty className="border-0 gap-4">
        <EmptyMedia>
          <FolderOpen className="size-12 text-muted-foreground/30" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            Loading files...
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  if (directoryIsError) {
    return (
      <Empty className="border-0 gap-4">
        <EmptyMedia>
          <FolderOpen className="size-12 text-status-red/50" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-sm font-normal text-status-red">
            {directoryErrorMessage}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  if (sortedEntries.length === 0) {
    return (
      <Empty className="border-0 gap-4">
        <EmptyMedia>
          {isGlobalSearchActive && globalSearchIsFetching ? (
            <Loader2 className="size-10 animate-spin text-muted-foreground/40" />
          ) : (
            <FolderOpen className="size-12 text-muted-foreground/30" />
          )}
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle className="text-sm font-normal text-muted-foreground">
            {isGlobalSearchActive
              ? globalSearchIsFetching
                ? "Searching..."
                : "No results found"
              : searchQuery
                ? "No matching files found"
                : "This folder is empty"}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const browser =
    viewMode === "grid" ? (
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
    );

  return (
    <>
      {browser}
      {hasMoreSearchResults ? (
        <LoadMoreBanner
          shown={sortedEntries.length}
          total={totalEntriesCount}
          onLoadMore={onLoadMoreSearch}
        />
      ) : null}
    </>
  );
}
