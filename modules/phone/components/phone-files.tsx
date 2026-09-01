"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Download, File, FileImage, Plus } from "@/components/icons/platform-icons";
import {
  getFileIcon,
  getLargeFileIcon,
  toUiFileEntry,
} from "@/modules/files/components/file-manager-presenters";
import { buildDownloadUrl, useFilesDirectory, useUploadFiles } from "@/modules/files/hooks/useFiles";
import type { FileListEntry } from "@/lib/shared/contracts/files";
import { cn } from "@/lib/utils";

/** Photos and videos first — the camera roll is what a phone actually uploads. */
const PICKERS = [
  {
    key: "media",
    label: "Photos & videos",
    hint: "From the camera roll",
    accept: "image/*,video/*",
    icon: FileImage,
  },
  { key: "any", label: "Any file", hint: "Browse the phone", accept: "", icon: File },
] as const;

/** Same shape as the Home screen's sizes: whole numbers until they stop being useful. */
function formatSize(bytes: number | null) {
  if (bytes === null) return null;
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * The path lives in the URL rather than in component state so the hardware back
 * button walks back up the tree: MainActivity pops WebView history first, and
 * history is the only thing it can see.
 */
function pathHref(filePath: string) {
  return filePath.length > 0 ? `/m/files?path=${encodeURIComponent(filePath)}` : "/m/files";
}

function Crumbs({ segments, onNavigate }: { segments: string[]; onNavigate: (path: string) => void }) {
  return (
    // Scrolls sideways instead of wrapping: a deep path must never push the
    // list down the screen.
    <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {["Home", ...segments].map((segment, index) => {
        const target = segments.slice(0, index).join("/");
        const isCurrent = index === segments.length;

        return (
          <button
            key={`${segment}-${index}`}
            type="button"
            onClick={() => !isCurrent && onNavigate(target)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12px] whitespace-nowrap transition-colors",
              isCurrent
                ? "bg-primary/15 font-medium text-primary"
                : "bg-white/6 text-muted-foreground active:bg-white/10",
            )}
          >
            {segment}
          </button>
        );
      })}
    </div>
  );
}

/** Bottom sheet: the phone-native place for a single item's actions. */
function FileSheet({ entry, onClose }: { entry: FileListEntry; onClose: () => void }) {
  const ui = toUiFileEntry(entry);
  const size = formatSize(entry.sizeBytes);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        className="relative animate-in slide-in-from-bottom-4 rounded-t-[1.75rem] border-t border-glass-border bg-[#121519] px-5 pt-2.5 pb-5 duration-200"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-white/15" />

        <div className="mt-4 flex items-center gap-3.5">
          <span className="flex size-14 shrink-0 items-center justify-center">
            {getLargeFileIcon(ui)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium">{entry.name}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {[size, formatDate(entry.modifiedAt)].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <a
            href={buildDownloadUrl(entry.path)}
            download={entry.name}
            onClick={onClose}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[13px] font-medium text-primary-foreground active:opacity-90"
          >
            <Download className="size-4" /> Download
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-12 items-center justify-center rounded-2xl border border-glass-border px-5 text-[13px] text-muted-foreground active:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Upload sheet: two ways in, because "camera roll" and "a file" are different pickers. */
function UploadSheet({
  onPick,
  onClose,
}: {
  onPick: (accept: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />

      <div
        className="relative animate-in slide-in-from-bottom-4 rounded-t-[1.75rem] border-t border-glass-border bg-[#121519] px-5 pt-2.5 pb-5 duration-200"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-10 rounded-full bg-white/15" />
        <p className="mt-4 text-[13px] text-muted-foreground">Upload to this folder</p>

        <div className="mt-3 flex flex-col gap-2">
          {PICKERS.map((picker) => {
            const Icon = picker.icon;

            return (
              <button
                key={picker.key}
                type="button"
                onClick={() => onPick(picker.accept)}
                className="flex min-h-14 items-center gap-3.5 rounded-2xl bg-white/5 px-3.5 py-2.5 text-left ring-1 ring-white/6 transition-transform active:scale-[0.99] active:bg-white/8"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/6">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[14px]">{picker.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{picker.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PhoneFiles() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get("path") ?? "";
  const segments = currentPath.split("/").filter(Boolean);

  const { data, isLoading, error } = useFilesDirectory(segments);
  const upload = useUploadFiles();
  const inputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<FileListEntry | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // A sheet left open across a folder change would act on the folder you left.
  useEffect(() => {
    setSelected(null);
    setShowUpload(false);
  }, [currentPath]);

  function navigate(filePath: string) {
    router.push(pathHref(filePath));
  }

  function pick(accept: string) {
    const input = inputRef.current;
    if (!input) return;
    input.accept = accept;
    setShowUpload(false);
    input.click();
  }

  async function onFilesChosen(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    setMessage(null);
    setProgress(0);

    try {
      const result = await upload.mutateAsync({
        destinationPath: currentPath,
        files,
        onProgress: (loaded, total) => setProgress(total > 0 ? (loaded / total) * 100 : 0),
      });
      const skipped = result.skipped.length;
      setMessage(
        `Uploaded ${result.uploaded.length} file${result.uploaded.length === 1 ? "" : "s"}` +
          (skipped > 0 ? `, skipped ${skipped}` : ""),
      );
    } catch (uploadError) {
      setMessage(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const entries = data?.entries ?? [];
  const folders = entries.filter((entry) => entry.type === "folder");
  const files = entries.filter((entry) => entry.type === "file");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-medium">
            {segments.length > 0 ? segments[segments.length - 1] : "Files"}
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {isLoading
              ? "Loading…"
              : `${folders.length} folder${folders.length === 1 ? "" : "s"} · ${files.length} file${files.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {/* In the header rather than a floating button: a position:fixed child
            of the 100dvh shell is what left a ghost band on Android (P1). */}
        <button
          type="button"
          onClick={() => setShowUpload(true)}
          aria-label="Upload"
          className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-95"
        >
          <Plus className="size-5" />
        </button>
      </div>

      <Crumbs segments={segments} onNavigate={navigate} />

      {progress !== null && (
        <div className="rounded-2xl border border-glass-border bg-black/25 px-3.5 py-3">
          <p className="text-[12px] text-muted-foreground">Uploading… {Math.round(progress)}%</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${Math.max(2, progress)}%` }}
            />
          </div>
        </div>
      )}

      {message && (
        <p className="rounded-xl border border-glass-border bg-black/20 px-3 py-2 text-[12px] text-muted-foreground">
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-status-red/30 bg-status-red/10 px-3 py-2 text-[12px] text-status-red"
        >
          {error instanceof Error ? error.message : "Could not open that folder."}
        </p>
      )}

      {isLoading && entries.length === 0 && !error && (
        <ul className="overflow-hidden rounded-3xl bg-white/4 ring-1 ring-white/6" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <li key={row} className="flex min-h-15 items-center gap-3.5 border-b border-white/5 px-3.5 py-2.5 last:border-b-0">
              <span className="size-10 shrink-0 animate-pulse rounded-2xl bg-white/6" />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="h-3 w-1/2 animate-pulse rounded-full bg-white/6" />
                <span className="h-2.5 w-1/4 animate-pulse rounded-full bg-white/4" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {!isLoading && entries.length === 0 && !error && (
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-white/5 ring-1 ring-white/6">
            <File className="size-6 opacity-60" />
          </span>
          <p className="mt-3 text-sm text-muted-foreground">This folder is empty</p>
          <p className="mt-1 text-[12px] text-muted-foreground/70">
            Upload a photo or a file to fill it.
          </p>
        </div>
      )}

      {folders.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Folders</h2>
          <div className="grid grid-cols-2 gap-2">
            {folders.map((entry) => (
              <button
                key={entry.path}
                type="button"
                onClick={() => navigate(entry.path)}
                className="flex flex-col items-start gap-2.5 rounded-3xl bg-gradient-to-b from-white/8 to-white/3 p-3.5 text-left ring-1 ring-white/6 transition-transform active:scale-[0.98] active:from-white/12"
              >
                <span className="grid size-11 place-items-center rounded-2xl bg-white/6">
                  {getFileIcon(toUiFileEntry(entry))}
                </span>
                <span className="w-full">
                  <span className="block truncate text-[13.5px] font-medium">{entry.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {formatDate(entry.modifiedAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Files</h2>
          <ul className="overflow-hidden rounded-3xl bg-white/4 ring-1 ring-white/6">
            {files.map((entry) => {
              const size = formatSize(entry.sizeBytes);

              return (
                <li key={entry.path} className="border-b border-white/5 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setSelected(entry)}
                    className="flex min-h-15 w-full items-center gap-3.5 px-3.5 py-2.5 text-left active:bg-white/6"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/6">
                      {getFileIcon(toUiFileEntry(entry))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px]">{entry.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {[size, formatDate(entry.modifiedAt)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 opacity-35" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => void onFilesChosen(event.target.files)}
      />

      {selected && <FileSheet entry={selected} onClose={() => setSelected(null)} />}
      {showUpload && <UploadSheet onPick={pick} onClose={() => setShowUpload(false)} />}
    </div>
  );
}
