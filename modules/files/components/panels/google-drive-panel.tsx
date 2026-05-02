"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FILES_PANEL_INSET } from "@/modules/files/components/file-manager-surface";
import {
  useGoogleDriveFiles,
  useGoogleDriveDeleteFile,
  useGoogleDriveCreateFolder,
  useGoogleDriveUpload,
  buildDriveDownloadUrl,
} from "@/modules/files/hooks/useGoogleDriveFiles";
import type { DriveFileEntry } from "@/lib/shared/contracts/google-drive";
import {
  Cloud,
  Loader2,
  Trash2,
  FolderOpen,
  Download,
  Upload,
  Plus,
  ChevronRight,
  File,
} from "@/components/icons/platform-icons";

type NavEntry = { id: string; name: string };

type Props = {
  connectionId: string;
  accountEmail: string;
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function isGoogleNative(mimeType: string): boolean {
  return mimeType.startsWith("application/vnd.google-apps.");
}

export function GoogleDrivePanel({ connectionId, accountEmail }: Props) {
  const [navStack, setNavStack] = useState<NavEntry[]>([{ id: "root", name: "My Drive" }]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DriveFileEntry | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const current = navStack[navStack.length - 1];
  const folderId = current.id;

  const browseQuery = useGoogleDriveFiles(connectionId, folderId);
  const deleteFile = useGoogleDriveDeleteFile(connectionId, folderId);
  const createFolder = useGoogleDriveCreateFolder(connectionId, folderId);
  const uploadFiles = useGoogleDriveUpload(connectionId, folderId);

  function navigateInto(entry: DriveFileEntry) {
    setNavStack((prev) => [...prev, { id: entry.id, name: entry.name }]);
  }

  function navigateTo(index: number) {
    setNavStack((prev) => prev.slice(0, index + 1));
  }

  function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    void uploadFiles.mutate({ files: Array.from(files) });
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder.mutate(
      { parentId: folderId, name },
      {
        onSuccess: () => {
          setNewFolderName("");
          setShowNewFolder(false);
        },
      },
    );
  }

  function handleDelete(entry: DriveFileEntry) {
    deleteFile.mutate(entry.id, { onSuccess: () => setDeleteConfirm(null) });
  }

  const entries = browseQuery.data?.entries ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className={cn("flex shrink-0 items-center justify-between border-b border-glass-border/50 px-4 py-2.5", FILES_PANEL_INSET)}>
        {/* Breadcrumb */}
        <nav className="flex min-w-0 items-center gap-1 text-[12px]">
          <Cloud className="size-3.5 shrink-0 text-sky-400" />
          {navStack.map((seg, i) => (
            <span key={seg.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" />}
              <button
                onClick={() => navigateTo(i)}
                className={cn(
                  "max-w-[120px] truncate transition-colors",
                  i === navStack.length - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {seg.name}
              </button>
            </span>
          ))}
        </nav>

        {/* Toolbar actions */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setShowNewFolder((v) => !v)}
            title="New folder"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background/50 hover:text-foreground"
          >
            <Plus className="size-4" />
          </button>
          <button
            onClick={() => uploadRef.current?.click()}
            title="Upload files"
            disabled={uploadFiles.isPending}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background/50 hover:text-foreground disabled:opacity-40"
          >
            {uploadFiles.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
          </button>
          <input
            ref={uploadRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className={cn("flex shrink-0 items-center gap-2 border-b border-glass-border/40 px-4 py-2", FILES_PANEL_INSET)}>
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") { setShowNewFolder(false); setNewFolderName(""); }
            }}
            placeholder="Folder name"
            className="h-7 flex-1 rounded-md border border-glass-border/60 bg-background/40 px-2 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim() || createFolder.isPending}
            className="rounded-md bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
          >
            {createFolder.isPending ? <Loader2 className="size-3 animate-spin" /> : "Create"}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {browseQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground/50" />
          </div>
        ) : browseQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Cloud className="size-10 text-muted-foreground/20" />
            <p className="text-sm text-status-red">
              {browseQuery.error instanceof Error ? browseQuery.error.message : "Failed to load"}
            </p>
            <button
              onClick={() => void browseQuery.refetch()}
              className="rounded-md bg-background/50 px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Retry
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <FolderOpen className="size-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">This folder is empty</p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-background/50"
              >
                {/* Icon */}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-glass-border/40 bg-background/40">
                  {entry.isFolder ? (
                    <FolderOpen className="size-4 text-amber-400/80" />
                  ) : (
                    <File className="size-4 text-muted-foreground/60" />
                  )}
                </span>

                {/* Name + meta */}
                <button
                  onClick={() => entry.isFolder && navigateInto(entry)}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col text-left",
                    entry.isFolder ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <span className="truncate text-[13px] font-medium text-foreground">
                    {entry.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {[formatSize(entry.size), formatDate(entry.modifiedAt)].filter(Boolean).join(" · ")}
                    {isGoogleNative(entry.mimeType) && (
                      <span className="ml-1 rounded-sm bg-sky-500/10 px-1 py-0.5 text-[9px] text-sky-400">
                        Google
                      </span>
                    )}
                  </span>
                </button>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {!entry.isFolder && !isGoogleNative(entry.mimeType) && (
                    <a
                      href={buildDriveDownloadUrl(connectionId, entry.id, entry.name, entry.mimeType)}
                      download={entry.name}
                      title="Download"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background/50 hover:text-foreground"
                    >
                      <Download className="size-3.5" />
                    </a>
                  )}
                  {!entry.isFolder && isGoogleNative(entry.mimeType) && entry.webViewLink && (
                    <a
                      href={entry.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in Google Drive"
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background/50 hover:text-sky-400"
                    >
                      <Cloud className="size-3.5" />
                    </a>
                  )}
                  <button
                    onClick={() => setDeleteConfirm(entry)}
                    title="Delete"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-background/50 hover:text-status-red"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={cn("shrink-0 border-t border-glass-border/50 px-4 py-2", FILES_PANEL_INSET)}>
        <p className="text-[11px] text-muted-foreground/50 truncate">
          <Cloud className="mr-1 inline-block size-3 text-sky-400/70" />
          {accountEmail}
        </p>
      </div>

      {/* Delete confirm overlay */}
      {deleteConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="w-72 rounded-xl border border-glass-border bg-popover/96 p-5 shadow-xl shadow-black/30">
            <p className="text-[13px] font-medium text-foreground">
              Delete &ldquo;{deleteConfirm.name}&rdquo;?
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              This will move the file to Google Drive Trash.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-md px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteFile.isPending}
                className="flex items-center gap-1.5 rounded-md bg-status-red/15 px-3 py-1.5 text-[11px] font-medium text-status-red transition-colors hover:bg-status-red/25 disabled:opacity-40"
              >
                {deleteFile.isPending && <Loader2 className="size-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
