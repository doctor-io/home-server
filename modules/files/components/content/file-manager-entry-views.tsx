"use client";

import { Loader2, MoreHorizontal, Star } from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";
import { buildAssetUrl } from "@/modules/files/hooks/files-api";
import {
  getFileIcon,
  getLargeFileIcon,
  type FileEntry,
} from "@/modules/files/components/file-manager-presenters";
import React, { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

/**
 * The visible handle on every entry. Actions used to live behind right-click
 * alone, which is the least discoverable gesture there is — especially on a
 * trackpad. This opens the same menu at the same place.
 *
 * It stays hidden until the row is hovered, focused or selected, so a dense
 * grid does not turn into a field of dots. Selection is what makes it reachable
 * without a hover: tap an entry, the handle appears.
 */
function EntryActionsButton({
  entry,
  isSelected,
  onEntryContextMenu,
  className,
}: {
  entry: FileEntry;
  isSelected: boolean;
  onEntryContextMenu: (event: MouseEvent, entry: FileEntry) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Actions for ${entry.name}`}
      title="Actions"
      onClick={(event) => {
        // Anchor the menu under the handle rather than at the pointer. A
        // keyboard activation reports clientX/clientY as 0, which the caller
        // would clamp into the window corner, far from the focused entry.
        const rect = event.currentTarget.getBoundingClientRect();
        onEntryContextMenu(
          {
            preventDefault: () => event.preventDefault(),
            stopPropagation: () => event.stopPropagation(),
            clientX: rect.left,
            clientY: rect.bottom,
          } as unknown as MouseEvent,
          entry,
        );
      }}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-all",
        "hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
        isSelected && "opacity-100",
        className,
      )}
    >
      {/* The icon set only ships a horizontal variant; rotating it gives the
          vertical ellipsis without adding another asset. */}
      <MoreHorizontal className="size-3.5 rotate-90" />
    </button>
  );
}

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
        className="rounded-lg bg-background/50 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-background/70"
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
    <div className="relative size-14">
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-opacity duration-150",
          status === "loaded" ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        {getLargeFileIcon(entry)}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={entry.name}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(
          "size-14 rounded-lg object-cover transition-opacity duration-150",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {visible.map((entry) => {
          const isImage = entry.type === "file" && IMAGE_EXTS.has((entry.ext ?? "").toLowerCase());
          const isSelected = selectedFiles.has(entry.name);
          return (
            <div
              key={entry.name}
              className={cn(
                "group relative rounded-xl border transition-all",
                isSelected
                  ? "border-primary/30 bg-primary/15"
                  : "border-transparent hover:bg-background/50",
              )}
            >
              <button
                title={titleFromPath ? entry.path : entry.name}
                onClick={(event) => onEntryClick(event, entry)}
                onDoubleClick={() => onOpenEntry(entry)}
                onContextMenu={(event) => onEntryContextMenu(event, entry)}
                className="flex w-full cursor-pointer flex-col items-center gap-3 p-4"
              >
              <div className="relative">
                {pendingEntryPath === entry.path ? (
                  <div className="flex size-14 items-center justify-center">
                    <Loader2 className="size-7 animate-spin text-primary" />
                  </div>
                ) : isImage ? (
                  <GridThumbnail entry={entry} />
                ) : (
                  getLargeFileIcon(entry)
                )}
                {entry.starred && pendingEntryPath !== entry.path && (
                  <Star className="absolute -right-1 -top-1 size-3.5 fill-amber-400 text-amber-400" />
                )}
              </div>
              <div className="flex w-full flex-col items-center gap-0.5">
                <span className="line-clamp-2 break-all text-center text-[13px] font-medium leading-tight text-foreground">
                  {entry.name}
                </span>
                {entry.size && (
                  <span className="text-2xs text-muted-foreground/60">{entry.size}</span>
                )}
              </div>
              </button>
              <EntryActionsButton
                entry={entry}
                isSelected={isSelected}
                onEntryContextMenu={onEntryContextMenu}
                className="absolute right-1 top-1"
              />
            </div>
          );
        })}
      </div>
      {limit < entries.length && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
        </div>
      )}
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
      <div className="flex items-center gap-3 border-b border-glass-border/60 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
        <span className="min-w-0 flex-1">Name</span>
        {isTrashView && <span className="hidden w-48 text-right lg:block">Original Location</span>}
        {isGlobalSearchActive && <span className="hidden w-48 text-right lg:block">Location</span>}
        <span className="hidden w-20 text-right sm:block">Size</span>
        <span className="hidden w-32 text-right md:block">
          {isTrashView ? "Deleted" : "Modified"}
        </span>
        <span className="w-7 shrink-0" aria-hidden="true" />
      </div>

      {visible.map((entry) => (
        <div
          key={entry.name}
          className={cn(
            "group flex items-center pr-2 transition-colors",
            selectedFiles.has(entry.name) ? "bg-primary/15" : "hover:bg-background/50",
          )}
        >
        <button
          onClick={(event) => onEntryClick(event, entry)}
          onDoubleClick={() => onOpenEntry(entry)}
          onContextMenu={(event) => onEntryContextMenu(event, entry)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-2.5 text-left"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {pendingEntryPath === entry.path ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            ) : (
              getFileIcon(entry)
            )}
            <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
            {entry.starred && pendingEntryPath !== entry.path && (
              <Star className="size-3 shrink-0 fill-amber-400 text-amber-400" />
            )}
          </div>

          {isTrashView && (
            <span
              className="hidden w-48 shrink-0 truncate text-right text-xs text-muted-foreground/60 lg:block"
              title={entry.trashOriginalPath}
            >
              {entry.trashOriginalPath ?? "—"}
            </span>
          )}

          {isGlobalSearchActive && (
            <span
              className="hidden w-48 shrink-0 truncate text-right text-xs text-muted-foreground/60 lg:block"
              title={entry.path}
            >
              {entry.path.includes("/")
                ? entry.path.slice(0, entry.path.lastIndexOf("/"))
                : "/"}
            </span>
          )}

          <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground/60 sm:block">
            {entry.type === "folder" ? "—" : (entry.size ?? "0 B")}
          </span>
          <span className="hidden w-32 shrink-0 text-right text-xs text-muted-foreground/60 md:block">
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
          <EntryActionsButton
            entry={entry}
            isSelected={selectedFiles.has(entry.name)}
            onEntryContextMenu={onEntryContextMenu}
            className="ml-1 shrink-0"
          />
        </div>
      ))}

      {limit < entries.length && (
        <div ref={sentinelRef} className="flex items-center justify-center py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
