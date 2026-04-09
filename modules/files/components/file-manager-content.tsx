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
import { FolderOpen, Loader2, MonitorSpeaker, Music, Pause, Play, Save, Star, Upload, X } from "@/components/icons/platform-icons";
import { formatBytesCompact } from "@/lib/client/format";
import { buildAssetUrl } from "@/modules/files/hooks/files-api";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { DragEventHandler, MouseEvent, ReactNode, SetStateAction } from "react";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);

const VIRTUAL_BATCH = 100; // items rendered per batch

/** Returns a limit that grows as user scrolls toward the sentinel */
function useVirtualLimit(total: number): [number, React.RefObject<HTMLDivElement | null>] {
  const [limit, setLimit] = useState(VIRTUAL_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLimit(VIRTUAL_BATCH);
  }, [total]);

  useEffect(() => {
    if (limit >= total) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setLimit((prev) => Math.min(prev + VIRTUAL_BATCH, total));
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [limit, total]);

  return [limit, sentinelRef];
}

type FileManagerFileAreaProps = {
  canSaveOpenFile: boolean;
  directoryErrorMessage: string;
  directoryIsError: boolean;
  directoryIsLoading: boolean;
  editorNotice: string | null;
  fileContentErrorMessage: string;
  fileContentIsError: boolean;
  fileContentIsLoading: boolean;
  hasMoreSearchResults: boolean;
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
  totalEntriesCount: number;
  viewMode: "grid" | "list";
  globalSearchIsFetching: boolean;
  onChangeOpenFileDraft: (value: SetStateAction<string>) => void;
  onCloseOpenFile: () => void;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onBackgroundContextMenu: (event: MouseEvent) => void;
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
        <>
          <FileGrid
            entries={sortedEntries}
            pendingEntryPath={pendingEntryPath}
            selectedFiles={selectedFiles}
            titleFromPath={isGlobalSearchActive}
            onEntryClick={onEntryClick}
            onEntryContextMenu={onEntryContextMenu}
            onOpenEntry={onOpenEntry}
          />
          {hasMoreSearchResults ? (
            <LoadMoreBanner
              shown={sortedEntries.length}
              total={totalEntriesCount}
              onLoadMore={onLoadMoreSearch}
            />
          ) : null}
        </>
      ) : (
        <>
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
          {hasMoreSearchResults ? (
            <LoadMoreBanner
              shown={sortedEntries.length}
              total={totalEntriesCount}
              onLoadMore={onLoadMoreSearch}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function LoadMoreBanner({
  shown,
  total,
  onLoadMore,
}: {
  shown: number;
  total: number;
  onLoadMore: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-center gap-3 py-2">
      <span className="text-xs text-muted-foreground">
        Showing {shown} of {total} results
      </span>
      <button
        onClick={onLoadMore}
        className="rounded-lg bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Load more
      </button>
    </div>
  );
}

// Lazy-loading image thumbnail for grid view
function GridThumbnail({ entry }: { entry: FileEntry }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const src = buildAssetUrl(entry.path);

  return (
    <div className="relative size-10">
      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${status === "loaded" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
        {getLargeFileIcon(entry)}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={entry.name}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={`size-10 rounded-md object-cover transition-opacity duration-150 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
      />
    </div>
  );
}

function AudioPlayer({ src, fileName }: { src: string; fileName: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [audioError, setAudioError] = useState(false);

  const formatTime = (s: number) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(isFinite(audio.duration) ? audio.duration : 0);
    const onEnded = () => setIsPlaying(false);
    const onError = () => setAudioError(true);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  return (
    <div className="flex h-full items-center justify-center bg-background/30 p-8">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-glass-border/60 bg-background/60 p-8 shadow-2xl backdrop-blur-md">
        <div className={`flex size-36 items-center justify-center rounded-2xl ring-1 ${audioError ? "bg-status-red/10 ring-status-red/20" : "bg-primary/10 ring-primary/20"}`}>
          <Music className={`size-16 ${audioError ? "text-status-red/60" : "text-primary/60"}`} />
        </div>
        {audioError ? (
          <p className="text-xs text-status-red">Failed to load audio file.</p>
        ) : null}
        <div className="w-full text-center">
          <p className="truncate text-sm font-semibold text-foreground" title={fileName}>
            {fileName}
          </p>
        </div>
        <div className="w-full">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              const audio = audioRef.current;
              if (audio) audio.currentTime = Number(e.target.value);
            }}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
          />
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={togglePlay}
            className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:brightness-110 active:scale-95"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
        </div>
        <div className="flex w-full items-center gap-2">
          <MonitorSpeaker className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
          />
        </div>
        <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      </div>
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
        ) : openFileViewer?.mode === "audio" ? (
          <AudioPlayer src={openFileAssetUrl} fileName={openFile.entry.name} />
        ) : openFileViewer?.mode === "too_large" ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
            <p className="text-sm text-muted-foreground">This file is too large to open in the editor.</p>
            <p className="text-xs text-muted-foreground/60">
              {formatBytesCompact(openFileViewer.sizeBytes)} — editor limit is 2 MB
            </p>
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
  const [limit, sentinelRef] = useVirtualLimit(entries.length);
  const visible = entries.slice(0, limit);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {visible.map((entry) => {
          const isImage = entry.type === "file" && IMAGE_EXTS.has((entry.ext ?? "").toLowerCase());
          return (
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
                ) : isImage ? (
                  <GridThumbnail entry={entry} />
                ) : (
                  getLargeFileIcon(entry)
                )}
                {entry.starred && pendingEntryPath !== entry.path ? (
                  <Star className="absolute -right-1 -top-1 size-3 fill-amber-400 text-amber-400" />
                ) : null}
              </div>
              <div className="flex w-full flex-col items-center gap-0.5">
                <span className="line-clamp-2 break-all text-center text-[13px] font-medium leading-tight text-foreground">
                  {entry.name}
                </span>
                {entry.size ? (
                  <span className="text-[11px] text-muted-foreground/80">{entry.size}</span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      {limit < entries.length ? (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
        </div>
      ) : null}
    </>
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
  const [limit, sentinelRef] = useVirtualLimit(entries.length);
  const visible = entries.slice(0, limit);

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

      {visible.map((entry) => (
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
            <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
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

          <span className="hidden w-20 shrink-0 text-right text-xs text-foreground/50 sm:block">
            {entry.type === "folder" ? "—" : (entry.size ?? "0 B")}
          </span>
          <span className="hidden w-32 shrink-0 text-right text-xs text-foreground/50 md:block">
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

      {limit < entries.length ? (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
        </div>
      ) : null}
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
