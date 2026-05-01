import { createElement } from "react";
import {
  FolderRegular,
  HardDriveRegular,
  HomeRegular,
  StarFilled,
  UsbRegular,
} from "@fluentui/react-icons";
import type { FileReadResponse } from "@/lib/shared/contracts/files";
import type { FileManagerSidebarSection, RemovableSidebarItem } from "@/modules/files/components/chrome/file-manager-sidebar";
import type { UsbDrive } from "@/lib/shared/contracts/usb";
import {
  normalizePathForDisplay,
  toUiFileEntry,
  type FileEntry,
} from "@/modules/files/components/file-manager-presenters";
import type { SortBy } from "@/modules/files/components/manager/file-manager-state";

const BYTES_PER_TB = 1024 ** 4;
const BYTES_PER_GB = 1024 ** 3;
const BYTES_PER_MB = 1024 ** 2;

export const STARRED_VIRTUAL_PATH = ["⭐Starred"] as const;

export const sidebarSections: FileManagerSidebarSection[] = [
  {
    title: "Favorites",
    items: [
      {
        name: "Home",
        icon: createElement(HomeRegular, { className: "size-4 text-muted-foreground" }),
        path: [],
      },
      {
        name: "Starred",
        icon: createElement(StarFilled, { className: "size-4 text-amber-400" }),
        path: [...STARRED_VIRTUAL_PATH],
      },
      {
        name: "Documents",
        icon: createElement(FolderRegular, { className: "size-4 text-sky-400" }),
        path: ["Documents"],
      },
      {
        name: "Downloads",
        icon: createElement(FolderRegular, { className: "size-4 text-emerald-400" }),
        path: ["Downloads"],
      },
      {
        name: "Media",
        icon: createElement(FolderRegular, { className: "size-4 text-amber-400" }),
        path: ["Media"],
      },
      {
        name: "Apps",
        icon: createElement(FolderRegular, { className: "size-4 text-violet-400" }),
        path: ["AppData"],
      },
    ],
  },
  {
    title: "Locations",
    items: [],
  },
];

export function formatStorageValue(bytes: number): string {
  if (bytes >= BYTES_PER_TB) {
    const value = (bytes / BYTES_PER_TB).toFixed(1);
    return `${value.endsWith(".0") ? value.slice(0, -2) : value} TB`;
  }
  if (bytes >= BYTES_PER_GB) {
    const value = (bytes / BYTES_PER_GB).toFixed(1);
    return `${value.endsWith(".0") ? value.slice(0, -2) : value} GB`;
  }
  return `${(bytes / BYTES_PER_MB).toFixed(0)} MB`;
}

export function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, 100));
}

export function sortEntries({
  currentEntries,
  isGlobalSearchActive,
  searchQuery,
  sortBy,
  sortDir,
}: {
  currentEntries: FileEntry[];
  isGlobalSearchActive: boolean;
  searchQuery: string;
  sortBy: SortBy;
  sortDir: "asc" | "desc";
}) {
  let entries = [...currentEntries];

  if (searchQuery && !isGlobalSearchActive) {
    const normalized = searchQuery.toLowerCase();
    entries = entries.filter((entry) => entry.name.toLowerCase().includes(normalized));
  }

  const folders = entries.filter((entry) => entry.type === "folder");
  const files = entries.filter((entry) => entry.type === "file");
  const dir = sortDir === "asc" ? 1 : -1;
  const sortFn = (left: FileEntry, right: FileEntry) => {
    if (sortBy === "name") return dir * left.name.localeCompare(right.name);
    if (sortBy === "modified") {
      return dir * (new Date(left.modifiedAt).getTime() - new Date(right.modifiedAt).getTime());
    }
    return dir * ((left.sizeBytes ?? 0) - (right.sizeBytes ?? 0));
  };

  return [...folders.sort(sortFn), ...files.sort(sortFn)];
}

export function getCurrentEntries({
  directoryEntries,
  globalEntries,
  isGlobalSearchActive,
  isStarredView,
  starredEntries,
}: {
  directoryEntries: unknown[] | undefined;
  globalEntries: unknown[] | undefined;
  isGlobalSearchActive: boolean;
  isStarredView: boolean;
  starredEntries: unknown[] | undefined;
}) {
  if (isGlobalSearchActive) {
    return (globalEntries ?? []).map(toUiFileEntry);
  }
  const rawEntries = isStarredView ? starredEntries ?? [] : directoryEntries ?? [];
  return rawEntries.map(toUiFileEntry);
}

export function getOpenFileDetails({
  fileDrafts,
  filePath,
  language,
  viewer,
}: {
  fileDrafts: Record<string, string>;
  filePath: string | null;
  language: string;
  viewer: FileReadResponse | null;
}) {
  const content =
    filePath && viewer?.mode === "text" ? (fileDrafts[filePath] ?? viewer.content ?? "") : "";
  const badgeLabel = viewer
    ? viewer.mode === "text"
      ? language
      : viewer.mode.replaceAll("_", " ")
    : language;
  const hasUnsavedChanges =
    filePath !== null &&
    viewer?.mode === "text" &&
    fileDrafts[filePath] !== undefined &&
    fileDrafts[filePath] !== (viewer.content ?? "");
  return { badgeLabel, content, hasUnsavedChanges };
}

export function getStorageSummary(
  storage: { totalBytes: number; usedBytes: number; usedPercent: number } | undefined,
) {
  if (!storage || storage.totalBytes <= 0) {
    return { percent: 0, text: "-- / --" };
  }
  return {
    percent: clampPercent(storage.usedPercent),
    text: `${formatStorageValue(storage.usedBytes)} / ${formatStorageValue(storage.totalBytes)}`,
  };
}

export function getViewFlags(currentPath: string[]) {
  return {
    isSharedView: currentPath[0] === "Shared",
    isStarredView: currentPath.length === 1 && currentPath[0] === STARRED_VIRTUAL_PATH[0],
    isTrashView: currentPath[0] === "Trash",
  };
}

export function getLocationItems(
  shares: Array<{ mountPath: string }> | undefined,
) {
  const hosts = new Map<string, string[]>();
  for (const share of shares ?? []) {
    const segments = share.mountPath.split("/").filter(Boolean);
    const hostSegment = segments[1];
    const rootSegment = segments[0];
    if (!hostSegment || !rootSegment) continue;
    hosts.set(hostSegment, [rootSegment, hostSegment]);
  }

  return Array.from(hosts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([host, hostPath]) => ({
      name: host,
      icon: createElement(HardDriveRegular, { className: "size-4 text-cyan-400" }),
      path: hostPath,
    }));
}

function usbPathSegment(label: string, id: string): string {
  return label.replace(/[^a-zA-Z0-9\-_]/g, "_").replace(/_+/g, "_").slice(0, 32) || id.slice(0, 8);
}

export function getRemovableItems(drives: UsbDrive[]): RemovableSidebarItem[] {
  return drives.map((drive) => ({
    name: drive.label,
    icon: createElement(UsbRegular, { className: "size-4 text-amber-400" }),
    path: ["Removable", usbPathSegment(drive.label, drive.id)],
    driveId: drive.id,
    isMounted: drive.isMounted,
  }));
}

export function getLocalSharesByPath(
  shares:
    | Array<{
        id: string;
        shareName: string;
        sourcePath: string;
        sharedPath: string;
        isMounted: boolean;
        isExported: boolean;
      }>
    | undefined,
) {
  const map = new Map<
    string,
    {
      id: string;
      shareName: string;
      sourcePath: string;
      sharedPath: string;
      isMounted: boolean;
      isExported: boolean;
    }
  >();
  for (const share of shares ?? []) {
    map.set(share.sourcePath, share);
    map.set(share.sharedPath, share);
  }
  return map;
}

export function getBrowserCounts(entries: FileEntry[]) {
  return {
    fileCount: entries.filter((entry) => entry.type === "file").length,
    folderCount: entries.filter((entry) => entry.type === "folder").length,
  };
}

export function getClipboardDisplayName(
  clipboardState: { names: string[] } | null,
) {
  if (!clipboardState) return null;
  return clipboardState.names.length === 1
    ? clipboardState.names[0]
    : `${clipboardState.names.length} items`;
}

export function getCurrentPathForDisplay(currentPath: string[]) {
  return normalizePathForDisplay(currentPath);
}

export function validateEntryName(name: string): string | null {
  if (name.includes("/") || name.includes("\0")) {
    return 'Name cannot contain "/" or null characters';
  }
  return null;
}
