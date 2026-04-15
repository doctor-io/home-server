"use client";

import { Loader2, Star } from "@/components/icons/platform-icons";
import { buildAssetUrl } from "@/modules/files/hooks/files-api";
import {
  getFileIcon,
  getLargeFileIcon,
  type FileEntry,
} from "@/modules/files/components/file-manager-presenters";
import React, { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
const VIRTUAL_BATCH = 100;

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

export function LoadMoreBanner({
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

function GridThumbnail({ entry }: { entry: FileEntry }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const src = buildAssetUrl(entry.path);

  return (
    <div className="relative size-10">
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
          status === "loaded" ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        {getLargeFileIcon(entry)}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={entry.name}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={`size-10 rounded-md object-cover transition-opacity duration-150 ${
          status === "loaded" ? "opacity-100" : "opacity-0"
        }`}
        loading="lazy"
      />
    </div>
  );
}

export function FileGrid({
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
              className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl p-3 transition-all ${
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
                  <span className="text-2xs text-muted-foreground/80">{entry.size}</span>
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

export function FileList({
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
          className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors ${
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
