"use client";

import type { FileInfoResponse } from "@/lib/shared/contracts/files";
import {
  FileManagerSidebar,
  FileManagerStatusBar,
  FileManagerToolbar,
  type FileManagerSidebarSection,
} from "@/modules/files/components/file-manager-chrome";
import { FileManagerFileArea } from "@/modules/files/components/file-manager-content";
import {
  CreateEntryDialog,
  EmptyTrashConfirmDialog,
  FileInfoDialogOverlay,
  RenameEntryDialog,
} from "@/modules/files/components/file-manager-dialogs";
import { FileManagerContextMenu } from "@/modules/files/components/file-manager-overlays";
import {
  getEditorLanguage,
  normalizePathForBackend,
  normalizePathForDisplay,
  toUiFileEntry,
  type FileEntry,
} from "@/modules/files/components/file-manager-presenters";
import { NetworkStorageDialog } from "@/modules/files/components/network-storage-dialog";
import {
  buildAssetUrl,
  buildDownloadUrl,
  buildZipUrl,
  toFilePath,
  useCreateFile,
  useCreateFolder,
  useFileContent,
  useFileEntryInfo,
  useFilesDirectory,
  useFilesRoot,
  usePasteFileEntry,
  useRenameFileEntry,
  useSaveFileContent,
  useSearchFiles,
  useStarredFiles,
  useToggleFileStar,
  useUploadFiles,
} from "@/modules/files/hooks/useFiles";
import {
  useCreateLocalFolderShare,
  useDeleteLocalFolderShare,
  useLocalFolderShares,
} from "@/modules/files/hooks/useLocalFolderShares";
import { useNetworkShares } from "@/modules/files/hooks/useNetworkShares";
import {
  useDeleteFromTrash,
  useEmptyTrash,
  useMoveToTrash,
  useRestoreFromTrash,
} from "@/modules/files/hooks/useTrashActions";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
import {
  AppsSettingsRegular,
  ArrowDownloadRegular,
  DocumentRegular,
  HardDriveRegular,
  HomeRegular,
  StarFilled,
  VideoRegular,
} from "@fluentui/react-icons";
import { FILES_PANEL_SHELL } from "@/modules/files/components/file-manager-surface";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const BYTES_PER_TB = 1024 ** 4;
const BYTES_PER_GB = 1024 ** 3;
const BYTES_PER_MB = 1024 ** 2;

function formatStorageValue(bytes: number): string {
  if (bytes >= BYTES_PER_TB) {
    const v = (bytes / BYTES_PER_TB).toFixed(1);
    return `${v.endsWith(".0") ? v.slice(0, -2) : v} TB`;
  }
  if (bytes >= BYTES_PER_GB) {
    const v = (bytes / BYTES_PER_GB).toFixed(1);
    return `${v.endsWith(".0") ? v.slice(0, -2) : v} GB`;
  }
  const v = (bytes / BYTES_PER_MB).toFixed(0);
  return `${v} MB`;
}

function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, 100));
}

// --- Sidebar Quick Access ---

const STARRED_VIRTUAL_PATH = ["⭐Starred"] as const;

const sidebarSections: FileManagerSidebarSection[] = [
  {
    title: "Favorites",
    items: [
      {
        name: "Home",
        icon: <HomeRegular className="size-4 text-muted-foreground" />,
        path: [],
      },
      {
        name: "Starred",
        icon: <StarFilled className="size-4 text-amber-400" />,
        path: [...STARRED_VIRTUAL_PATH],
      },
      {
        name: "Documents",
        icon: <DocumentRegular className="size-4 text-sky-400" />,
        path: ["Documents"],
      },
      {
        name: "Downloads",
        icon: <ArrowDownloadRegular className="size-4 text-emerald-400" />,
        path: ["Downloads"],
      },
      {
        name: "Media",
        icon: <VideoRegular className="size-4 text-amber-400" />,
        path: ["Media"],
      },
      {
        name: "Apps",
        icon: <AppsSettingsRegular className="size-4 text-violet-400" />,
        path: ["AppData"],
      },
    ],
  },
  {
    title: "Locations",
    items: [],
  },
];

// --- Component ---

type ViewMode = "grid" | "list";
type SortBy = "name" | "modified" | "size";
type OpenFileState = { path: string[]; entry: FileEntry };
type ClipboardState = {
  sourcePath: string;
  operation: "copy" | "move";
  name: string;
};
type CreateEntryDialogState = {
  kind: "file" | "folder";
  name: string;
  error: string | null;
};
type RenameDialogState = {
  entry: FileEntry;
  name: string;
  error: string | null;
};

export function FileManager() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showContextMenu, setShowContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const [sidebarCollapsed] = useState(false);
  const [openFile, setOpenFile] = useState<OpenFileState | null>(null);
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [statusNotice, setStatusNoticeRaw] = useState<string | null>(null);
  const statusNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  function setStatusNotice(msg: string | null) {
    if (statusNoticeTimerRef.current)
      clearTimeout(statusNoticeTimerRef.current);
    setStatusNoticeRaw(msg);
    if (msg !== null) {
      statusNoticeTimerRef.current = setTimeout(
        () => setStatusNoticeRaw(null),
        4000,
      );
    }
  }
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [clipboardState, setClipboardState] = useState<ClipboardState | null>(
    null,
  );
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [createEntryDialog, setCreateEntryDialog] =
    useState<CreateEntryDialogState | null>(null);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(
    null,
  );
  const [fileInfoDialog, setFileInfoDialog] = useState<FileInfoResponse | null>(
    null,
  );
  const [pendingEntryPath, setPendingEntryPath] = useState<string | null>(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);

  const isStarredView =
    currentPath.length === 1 && currentPath[0] === STARRED_VIRTUAL_PATH[0];

  const filesRootQuery = useFilesRoot();
  const directoryQuery = useFilesDirectory(
    isStarredView ? [] : currentPath,
    includeHidden,
    { enabled: !isStarredView },
  );
  const starredFilesQuery = useStarredFiles();
  const systemMetricsQuery = useSystemMetrics();
  const networkSharesQuery = useNetworkShares();
  const localSharesQuery = useLocalFolderShares();
  const createFolderMutation = useCreateFolder();
  const createFileMutation = useCreateFile();
  const pasteFileEntryMutation = usePasteFileEntry();
  const createLocalShareMutation = useCreateLocalFolderShare();
  const deleteLocalShareMutation = useDeleteLocalFolderShare();
  const saveFileContentMutation = useSaveFileContent();
  const moveToTrashMutation = useMoveToTrash();
  const restoreFromTrashMutation = useRestoreFromTrash();
  const deleteFromTrashMutation = useDeleteFromTrash();
  const emptyTrashMutation = useEmptyTrash();
  const renameFileEntryMutation = useRenameFileEntry();
  const getFileInfoMutation = useFileEntryInfo();
  const toggleStarMutation = useToggleFileStar();
  const uploadFilesMutation = useUploadFiles();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const openFilePath = openFile ? toFilePath(openFile.path) : null;
  const fileContentQuery = useFileContent(openFilePath);
  const globalSearchQuery = useSearchFiles({
    query: searchQuery,
    basePath: undefined, // always search from root
    includeHidden,
    enabled: globalSearch && searchQuery.trim().length >= 2,
  });

  const isGlobalSearchActive = globalSearch && searchQuery.trim().length >= 2;

  const currentEntries = useMemo(() => {
    if (isGlobalSearchActive) {
      return (globalSearchQuery.data?.entries ?? []).map(toUiFileEntry);
    }
    const rawEntries = isStarredView
      ? (starredFilesQuery.data?.entries ?? [])
      : (directoryQuery.data?.entries ?? []);
    return rawEntries.map(toUiFileEntry);
  }, [
    isGlobalSearchActive,
    globalSearchQuery.data?.entries,
    isStarredView,
    starredFilesQuery.data?.entries,
    directoryQuery.data?.entries,
  ]);

  const sortedEntries = useMemo(() => {
    let entries = [...currentEntries];

    // Local filter only applies when NOT in global search mode
    if (searchQuery && !isGlobalSearchActive) {
      entries = entries.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Folders first, then files
    const folders = entries.filter((e) => e.type === "folder");
    const files = entries.filter((e) => e.type === "file");

    const dir = sortDir === "asc" ? 1 : -1;
    const sortFn = (a: FileEntry, b: FileEntry) => {
      if (sortBy === "name") return dir * a.name.localeCompare(b.name);
      if (sortBy === "modified") {
        return (
          dir *
          (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime())
        );
      }
      if (sortBy === "size")
        return dir * ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0));
      return 0;
    };

    return [...folders.sort(sortFn), ...files.sort(sortFn)];
  }, [currentEntries, isGlobalSearchActive, searchQuery, sortBy, sortDir]);

  const openFileKey = openFilePath;
  const openFileLanguage = openFile
    ? getEditorLanguage(openFile.entry)
    : "plaintext";
  const openFileViewer = fileContentQuery.data ?? null;
  const openFileContent =
    openFileKey && openFileViewer?.mode === "text"
      ? (fileDrafts[openFileKey] ?? openFileViewer.content ?? "")
      : "";
  const openFileBadgeLabel = openFileViewer
    ? openFileViewer.mode === "text"
      ? openFileLanguage
      : openFileViewer.mode.replaceAll("_", " ")
    : openFileLanguage;
  const openFileAssetUrl = openFileKey ? buildAssetUrl(openFileKey) : "";
  const canSaveOpenFile = Boolean(
    openFileKey &&
    openFileViewer?.mode === "text" &&
    !fileContentQuery.isLoading &&
    !saveFileContentMutation.isPending,
  );
  const isTrashView = currentPath[0] === "Trash";
  const isSharedView = currentPath[0] === "Shared";
  const storageMetrics = systemMetricsQuery.data?.storage;
  const storageUsageText =
    storageMetrics && storageMetrics.totalBytes > 0
      ? `${formatStorageValue(storageMetrics.usedBytes)} / ${formatStorageValue(storageMetrics.totalBytes)}`
      : "-- / --";
  const storageUsagePercent = clampPercent(storageMetrics?.usedPercent);
  const currentPathForDisplay = useMemo(
    () => normalizePathForDisplay(currentPath),
    [currentPath],
  );
  const filesRootPath = filesRootQuery.data?.rootPath ?? "";
  const rootLabel = filesRootPath.length > 0 ? filesRootPath : "/DATA";
  const localSharesByPath = useMemo(() => {
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
    for (const share of localSharesQuery.data ?? []) {
      map.set(share.sourcePath, share);
      map.set(share.sharedPath, share);
    }
    return map;
  }, [localSharesQuery.data]);
  const locationItems = useMemo(() => {
    const shares = networkSharesQuery.data ?? [];
    const hosts = new Map<string, string[]>();

    for (const share of shares) {
      const segments = share.mountPath.split("/").filter(Boolean);
      const hostSegment = segments[1];
      const rootSegment = segments[0];
      if (!hostSegment || !rootSegment) {
        continue;
      }
      if (hostSegment) {
        hosts.set(hostSegment, [rootSegment, hostSegment]);
      }
    }

    return Array.from(hosts.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([host, hostPath]) => ({
        name: host,
        icon: <HardDriveRegular className="size-4 text-cyan-400" />,
        path: hostPath,
      }));
  }, [networkSharesQuery.data]);

  useEffect(() => {
    if (!openFileKey || !openFileViewer || openFileViewer.mode !== "text")
      return;

    setFileDrafts((prev) => {
      if (prev[openFileKey] !== undefined) return prev;
      return {
        ...prev,
        [openFileKey]: openFileViewer.content ?? "",
      };
    });
  }, [openFileKey, openFileViewer]);

  useEffect(() => {
    setEditorNotice(null);
  }, [openFileKey]);

  const navigateToEvent = useEffectEvent((entry: FileEntry) => {
    navigateTo(entry);
  });
  const navigateUpEvent = useEffectEvent(() => {
    navigateUp();
  });
  const deleteFromTrashEvent = useEffectEvent((entry: FileEntry) => {
    void handleDeleteFromTrash(entry);
  });
  const moveToTrashEvent = useEffectEvent((entry: FileEntry) => {
    void handleMoveSelectedToTrash(entry);
  });

  // Keyboard navigation — only fires when no input/textarea is focused
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't hijack keystrokes while an input, textarea, or contenteditable is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      // Don't steal shortcuts while any dialog overlay is open
      if (
        createEntryDialog ||
        renameDialog ||
        fileInfoDialog ||
        showEmptyTrashConfirm ||
        showContextMenu
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        if (openFile) {
          setOpenFile(null);
        } else if (selectedFile || selectedFiles.size > 0) {
          clearSelection();
        } else if (searchQuery) {
          setSearchQuery("");
        }
        return;
      }

      // Arrow-key navigation only makes sense in the directory view
      if (openFile) return;

      const entries = sortedEntries;
      if (entries.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = selectedFile
          ? entries.findIndex((en) => en.name === selectedFile)
          : -1;
        const nextIdx =
          e.key === "ArrowDown"
            ? Math.min(currentIdx + 1, entries.length - 1)
            : Math.max(currentIdx - 1, 0);
        setSelectedFile(entries[nextIdx].name);
        setSelectedFiles(new Set([entries[nextIdx].name]));
        return;
      }

      if (e.key === "Enter" || e.key === "ArrowRight") {
        if (!selectedFile) return;
        const entry = entries.find((en) => en.name === selectedFile);
        if (!entry) return;
        e.preventDefault();
        navigateToEvent(entry);
        return;
      }

      if (e.key === "Backspace" || e.key === "ArrowLeft") {
        if (currentPath.length > 0 && !isStarredView) {
          e.preventDefault();
          navigateUpEvent();
        }
        return;
      }

      if (e.key === "Delete") {
        const toDelete =
          selectedFiles.size > 0
            ? [...selectedFiles]
            : selectedFile
              ? [selectedFile]
              : [];
        if (toDelete.length === 0) return;
        e.preventDefault();
        for (const name of toDelete) {
          const entry = entries.find((en) => en.name === name);
          if (!entry) continue;
          if (isTrashView) {
            deleteFromTrashEvent(entry);
          } else {
            moveToTrashEvent(entry);
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    sortedEntries,
    selectedFile,
    selectedFiles,
    openFile,
    currentPath,
    isStarredView,
    isTrashView,
    searchQuery,
    createEntryDialog,
    renameDialog,
    fileInfoDialog,
    showEmptyTrashConfirm,
    showContextMenu,
  ]);

  function clearSelection() {
    setSelectedFile(null);
    setSelectedFiles(new Set());
  }

  function openFileInEditor(path: string[], entry: FileEntry) {
    setOpenFile({ path, entry });
    setSelectedFile(entry.name);
    setSelectedFiles(new Set([entry.name]));
  }

  function navigateTo(entry: FileEntry) {
    if (entry.type === "folder") {
      setCurrentPath(entry.path.split("/").filter(Boolean));
      clearSelection();
      setOpenFile(null);
      return;
    }

    openFileInEditor(entry.path.split("/").filter(Boolean), entry);
  }

  function navigateToPath(pathSegments: string[]) {
    setCurrentPath(normalizePathForBackend(pathSegments));
    clearSelection();
    setSearchQuery("");
    setOpenFile(null);
    setStatusNotice(null);
  }

  function navigateUp() {
    setCurrentPath((prev) => prev.slice(0, -1));
    clearSelection();
    setOpenFile(null);
  }

  function handleEntryClick(e: React.MouseEvent, entry: FileEntry) {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+click: toggle individual item
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(entry.name)) {
          next.delete(entry.name);
        } else {
          next.add(entry.name);
        }
        return next;
      });
      setSelectedFile(entry.name);
    } else if (e.shiftKey && selectedFile) {
      // Shift+click: range-select from anchor to clicked item
      const anchorIdx = sortedEntries.findIndex(
        (en) => en.name === selectedFile,
      );
      const clickedIdx = sortedEntries.findIndex(
        (en) => en.name === entry.name,
      );
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [from, to] =
          anchorIdx <= clickedIdx
            ? [anchorIdx, clickedIdx]
            : [clickedIdx, anchorIdx];
        setSelectedFiles(
          new Set(sortedEntries.slice(from, to + 1).map((en) => en.name)),
        );
      }
      setSelectedFile(entry.name);
    } else {
      // Plain click
      setSelectedFiles(new Set([entry.name]));
      setSelectedFile(entry.name);
    }
  }

  async function handleTrashSelected() {
    const names = [...selectedFiles];
    if (names.length === 0) return;
    clearSelection();
    for (const name of names) {
      const entry = sortedEntries.find((en) => en.name === name);
      if (!entry) continue;
      try {
        await moveToTrashMutation.mutateAsync({ path: entry.path });
      } catch {
        // individual errors surfaced by mutation error handling
      }
    }
  }

  async function handleCreateEntry(kind: "file" | "folder", name: string) {
    const normalizedName = name.trim();
    if (normalizedName.length === 0) {
      throw new Error(`Invalid ${kind} name`);
    }
    const parentPath = toFilePath(currentPath);

    const result =
      kind === "folder"
        ? await createFolderMutation.mutateAsync({
            parentPath,
            name: normalizedName,
          })
        : await createFileMutation.mutateAsync({
            parentPath,
            name: normalizedName,
          });

    setStatusNotice(
      `${kind === "folder" ? "Folder" : "File"} created: ${result.path}`,
    );
  }

  function openCreateEntryDialog(kind: "file" | "folder") {
    setCreateEntryDialog({
      kind,
      name: "",
      error: null,
    });
  }

  function closeCreateEntryDialog() {
    if (createFolderMutation.isPending || createFileMutation.isPending) {
      return;
    }
    setCreateEntryDialog(null);
  }

  async function submitCreateEntryDialog() {
    if (!createEntryDialog) {
      return;
    }

    const kind = createEntryDialog.kind;
    try {
      await handleCreateEntry(kind, createEntryDialog.name);
      setCreateEntryDialog(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Failed to create ${kind}`;
      setCreateEntryDialog((previous) =>
        previous
          ? {
              ...previous,
              error: message,
            }
          : previous,
      );
      setStatusNotice(message);
    }
  }

  function setClipboardFromEntry(entry: FileEntry, operation: "copy" | "move") {
    setClipboardState({
      sourcePath: entry.path,
      operation,
      name: entry.name,
    });
    setStatusNotice(
      `${operation === "copy" ? "Copied" : "Cut"}: ${entry.name}`,
    );
  }

  async function handlePasteToDestination(destinationPath: string) {
    if (!clipboardState) {
      setStatusNotice("Clipboard is empty");
      return;
    }

    try {
      const result = await pasteFileEntryMutation.mutateAsync({
        sourcePath: clipboardState.sourcePath,
        destinationPath,
        operation: clipboardState.operation,
      });
      setStatusNotice(
        `${clipboardState.operation === "copy" ? "Copied" : "Moved"} to ${result.path}`,
      );
      if (clipboardState.operation === "move") {
        setClipboardState(null);
        if (
          openFile &&
          toFilePath(openFile.path) === clipboardState.sourcePath
        ) {
          setOpenFile(null);
        }
      }
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Paste failed");
    }
  }

  function handleContextMenu(e: React.MouseEvent, entry: FileEntry) {
    e.preventDefault();
    const menuWidth = 220;
    const menuHeight = 260;
    const rootRect = rootRef.current?.getBoundingClientRect();

    if (!rootRect) return;

    const x = Math.min(
      Math.max(8, e.clientX - rootRect.left),
      rootRect.width - menuWidth - 8,
    );
    const y = Math.min(
      Math.max(8, e.clientY - rootRect.top),
      rootRect.height - menuHeight - 8,
    );
    setShowContextMenu({ x, y, entry });
    setSelectedFile(entry.name);
  }

  async function handleSaveOpenFile() {
    if (!openFileKey || !openFileViewer || openFileViewer.mode !== "text") {
      return;
    }

    const nextContent = fileDrafts[openFileKey] ?? openFileViewer.content ?? "";
    try {
      await saveFileContentMutation.mutateAsync({
        path: openFileKey,
        content: nextContent,
        expectedMtimeMs: openFileViewer.mtimeMs,
      });
      setEditorNotice("Saved");
    } catch (error) {
      setEditorNotice(
        error instanceof Error ? error.message : "Failed to save file",
      );
    }
  }

  async function handleMoveSelectedToTrash(entry: FileEntry) {
    setPendingEntryPath(entry.path);
    try {
      const result = await moveToTrashMutation.mutateAsync({
        path: entry.path,
      });
      if (openFile && toFilePath(openFile.path) === entry.path) {
        setOpenFile(null);
      }
      setSelectedFile(null);
      setStatusNotice(`Moved to Trash: ${result.trashPath}`);
    } catch (error) {
      setStatusNotice(
        error instanceof Error ? error.message : "Failed to move item to Trash",
      );
    } finally {
      setPendingEntryPath(null);
    }
  }

  async function handleRestoreFromTrash(entry: FileEntry) {
    setPendingEntryPath(entry.path);
    try {
      const result = await restoreFromTrashMutation.mutateAsync({
        path: entry.path,
        collision: "keep-both",
      });
      setSelectedFile(null);
      setStatusNotice(`Restored: ${result.restoredPath}`);
    } catch (error) {
      setStatusNotice(
        error instanceof Error
          ? error.message
          : "Failed to restore item from Trash",
      );
    } finally {
      setPendingEntryPath(null);
    }
  }

  async function handleDeleteFromTrash(entry: FileEntry) {
    setPendingEntryPath(entry.path);
    try {
      await deleteFromTrashMutation.mutateAsync({
        path: entry.path,
      });
      setSelectedFile(null);
      setStatusNotice(`Deleted permanently: ${entry.name}`);
    } catch (error) {
      setStatusNotice(
        error instanceof Error
          ? error.message
          : "Failed to permanently delete item",
      );
    } finally {
      setPendingEntryPath(null);
    }
  }

  function handleEmptyTrash() {
    const totalCount =
      directoryQuery.data?.entries.length ?? currentEntries.length;
    if (!isTrashView || totalCount === 0 || isEmptyingTrash) return;
    setShowEmptyTrashConfirm(true);
  }

  async function confirmEmptyTrash() {
    setShowEmptyTrashConfirm(false);
    setIsEmptyingTrash(true);
    try {
      const result = await emptyTrashMutation.mutateAsync();
      setStatusNotice(
        `Trash emptied (${result.deletedCount} item${result.deletedCount !== 1 ? "s" : ""})`,
      );
    } catch (error) {
      setStatusNotice(
        error instanceof Error ? error.message : "Failed to empty Trash",
      );
    } finally {
      setIsEmptyingTrash(false);
    }
  }

  function handleRenameEntry(entry: FileEntry) {
    if (isTrashView) {
      setStatusNotice("Rename is disabled in Trash");
      return;
    }
    setRenameDialog({ entry, name: entry.name, error: null });
  }

  function closeRenameDialog() {
    if (renameFileEntryMutation.isPending) return;
    setRenameDialog(null);
  }

  async function submitRenameDialog() {
    if (!renameDialog) return;
    const newName = renameDialog.name.trim();
    if (!newName || newName === renameDialog.entry.name) {
      setRenameDialog(null);
      return;
    }
    try {
      const result = await renameFileEntryMutation.mutateAsync({
        path: renameDialog.entry.path,
        newName,
      });
      setRenameDialog(null);
      setSelectedFile(null);
      setStatusNotice(`Renamed to ${result.path.split("/").pop() ?? newName}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename item";
      setRenameDialog((prev) => (prev ? { ...prev, error: message } : prev));
    }
  }

  async function handleGetInfo(entry: FileEntry) {
    try {
      const info = await getFileInfoMutation.mutateAsync(entry.path);
      setFileInfoDialog(info);
    } catch (error) {
      setStatusNotice(
        error instanceof Error ? error.message : "Failed to get item info",
      );
    }
  }

  async function handleToggleStar(entry: FileEntry) {
    try {
      const result = await toggleStarMutation.mutateAsync(entry.path);
      setStatusNotice(
        result.starred ? `Starred ${entry.name}` : `Unstarred ${entry.name}`,
      );
    } catch (error) {
      setStatusNotice(
        error instanceof Error ? error.message : "Failed to toggle star",
      );
    }
  }

  async function handleUploadFiles(files: File[]) {
    if (files.length === 0 || isTrashView || isStarredView) return;
    const destinationPath = toFilePath(currentPath);
    try {
      const result = await uploadFilesMutation.mutateAsync({
        destinationPath,
        files,
        includeHidden,
      });
      const uploaded = result.uploaded.length;
      const skipped = result.skipped.length;
      if (uploaded > 0 && skipped === 0) {
        setStatusNotice(
          `Uploaded ${uploaded} file${uploaded !== 1 ? "s" : ""}`,
        );
      } else if (uploaded > 0) {
        setStatusNotice(
          `Uploaded ${uploaded}, skipped ${skipped} (already exist)`,
        );
      } else {
        setStatusNotice(
          `Skipped ${skipped} file${skipped !== 1 ? "s" : ""} (already exist)`,
        );
      }
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Upload failed");
    }
  }

  function handleDownloadEntry(entry: FileEntry) {
    if (entry.type === "folder") {
      const zipUrl = buildZipUrl(entry.path);
      window.open(zipUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const downloadUrl = buildDownloadUrl(entry.path);
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function handleShareFolder(entry: FileEntry) {
    try {
      const result = await createLocalShareMutation.mutateAsync({
        path: entry.path,
      });
      setStatusNotice(`Shared over network: /${result.sharedPath}`);
    } catch (error) {
      setStatusNotice(
        error instanceof Error ? error.message : "Failed to share folder",
      );
    }
  }

  async function handleUnshareFolder(shareId: string) {
    try {
      await deleteLocalShareMutation.mutateAsync(shareId);
      setStatusNotice("Shared folder removed");
    } catch (error) {
      setStatusNotice(
        error instanceof Error
          ? error.message
          : "Failed to remove shared folder",
      );
    }
  }

  async function handleCopyEntryPath(entry: FileEntry) {
    const hostname = systemMetricsQuery.data?.hostname ?? "";
    const networkAddress = systemMetricsQuery.data?.wifi?.ipv4 ?? hostname;
    const absolutePath = filesRootPath
      ? `${filesRootPath}/${entry.path}`
      : `/${entry.path}`;
    const fullPath =
      entry.path === "Shared" || entry.path.startsWith("Shared/")
        ? networkAddress
          ? `smb://${networkAddress}${absolutePath}`
          : absolutePath
        : absolutePath;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullPath);
      } else {
        const el = document.createElement("textarea");
        el.value = fullPath;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (!ok) throw new Error("execCommand failed");
      }
      toast.success("Path copied to clipboard");
    } catch {
      toast.error("Could not copy automatically", {
        description: fullPath,
      });
    }
  }

  // Count items
  const folderCount = sortedEntries.filter((e) => e.type === "folder").length;
  const fileCount = sortedEntries.filter((e) => e.type === "file").length;
  const contextShare =
    showContextMenu?.entry.type === "folder"
      ? localSharesByPath.get(showContextMenu.entry.path)
      : undefined;
  const trashItemCount =
    directoryQuery.data?.entries.length ?? currentEntries.length;

  return (
    <div
      ref={rootRef}
      className="relative flex h-full"
      onClick={() => setShowContextMenu(null)}
    >
      {!sidebarCollapsed && (
        <FileManagerSidebar
          currentPath={currentPath}
          isSharedView={isSharedView}
          isTrashView={isTrashView}
          locationItems={locationItems}
          sidebarSections={sidebarSections}
          storageUsagePercent={storageUsagePercent}
          storageUsageText={storageUsageText}
          onNavigateToPath={navigateToPath}
          onOpenNetworkDialog={() => setShowNetworkDialog(true)}
        />
      )}

      <div className={`m-2 flex min-w-0 flex-1 flex-col ${FILES_PANEL_SHELL}`}>
        <FileManagerToolbar
          canNavigateUp={currentPath.length > 0}
          createFilePending={createFileMutation.isPending}
          createFolderPending={createFolderMutation.isPending}
          currentEntriesCount={currentEntries.length}
          currentPath={currentPath}
          currentPathForDisplay={currentPathForDisplay}
          emptyTrashPending={emptyTrashMutation.isPending}
          globalSearch={globalSearch}
          globalSearchIsFetching={globalSearchQuery.isFetching}
          includeHidden={includeHidden}
          isEmptyingTrash={isEmptyingTrash}
          isStarredView={isStarredView}
          isTrashView={isTrashView}
          rootLabel={rootLabel}
          searchQuery={searchQuery}
          sortBy={sortBy}
          sortDir={sortDir}
          uploadFilesPending={uploadFilesMutation.isPending}
          uploadInputRef={uploadInputRef}
          viewMode={viewMode}
          onCycleSortBy={() => {
            setSortBy((value) => {
              const next =
                value === "name"
                  ? "modified"
                  : value === "modified"
                    ? "size"
                    : "name";
              setSortDir("asc");
              return next;
            });
          }}
          onEmptyTrash={() => {
            void handleEmptyTrash();
          }}
          onNavigateToPath={navigateToPath}
          onNavigateUp={navigateUp}
          onOpenCreateEntryDialog={openCreateEntryDialog}
          onSearchQueryChange={setSearchQuery}
          onSetViewMode={setViewMode}
          onToggleGlobalSearch={() => setGlobalSearch((value) => !value)}
          onToggleIncludeHidden={() => setIncludeHidden((value) => !value)}
          onToggleSortDir={() =>
            setSortDir((value) => (value === "asc" ? "desc" : "asc"))
          }
          onUploadInputChange={(files) => {
            void handleUploadFiles(files);
          }}
        />

        <FileManagerFileArea
          canSaveOpenFile={canSaveOpenFile}
          directoryErrorMessage={
            directoryQuery.error instanceof Error
              ? directoryQuery.error.message
              : "Failed to load files"
          }
          directoryIsError={directoryQuery.isError}
          directoryIsLoading={directoryQuery.isLoading}
          editorNotice={editorNotice}
          fileContentErrorMessage={
            fileContentQuery.error instanceof Error
              ? fileContentQuery.error.message
              : "Failed to open file"
          }
          fileContentIsError={fileContentQuery.isError}
          fileContentIsLoading={fileContentQuery.isLoading}
          globalSearchIsFetching={globalSearchQuery.isFetching}
          isDragOver={isDragOver}
          isGlobalSearchActive={isGlobalSearchActive}
          isStarredView={isStarredView}
          isTrashView={isTrashView}
          openFile={openFile}
          openFileAssetUrl={openFileAssetUrl}
          openFileBadgeLabel={openFileBadgeLabel}
          openFileContent={openFileContent}
          openFileKey={openFileKey}
          openFileLanguage={openFileLanguage}
          openFileViewer={openFileViewer}
          pendingEntryPath={pendingEntryPath}
          searchQuery={searchQuery}
          selectedFiles={selectedFiles}
          sortedEntries={sortedEntries}
          viewMode={viewMode}
          onChangeOpenFileDraft={(value) => {
            if (!openFileKey) return;
            setFileDrafts((prev) => ({
              ...prev,
              [openFileKey]:
                typeof value === "function"
                  ? value(prev[openFileKey] ?? "")
                  : value,
            }));
          }}
          onCloseOpenFile={() => setOpenFile(null)}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDragOver={(event) => {
            if (isTrashView || isStarredView) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragOver(false);
            if (isTrashView || isStarredView) return;
            void handleUploadFiles(Array.from(event.dataTransfer.files));
          }}
          onEntryClick={handleEntryClick}
          onEntryContextMenu={handleContextMenu}
          onOpenEntry={navigateTo}
          onSaveOpenFile={() => {
            void handleSaveOpenFile();
          }}
        />

        <FileManagerStatusBar
          clipboardName={clipboardState?.name ?? null}
          clipboardOperation={clipboardState?.operation ?? null}
          currentPathForDisplay={currentPathForDisplay}
          fileCount={fileCount}
          folderCount={folderCount}
          isStarredView={isStarredView}
          isTrashView={isTrashView}
          rootLabel={rootLabel}
          selectedFilesCount={selectedFiles.size}
          statusNotice={statusNotice}
          onTrashSelected={() => {
            void handleTrashSelected();
          }}
        />
      </div>

      {showContextMenu ? (
        <FileManagerContextMenu
          contextShareActive={Boolean(contextShare)}
          entry={showContextMenu.entry}
          isTrashView={isTrashView}
          pasteDisabled={
            !clipboardState || isTrashView || pasteFileEntryMutation.isPending
          }
          x={showContextMenu.x}
          y={showContextMenu.y}
          onClose={() => setShowContextMenu(null)}
          onCopy={() => setClipboardFromEntry(showContextMenu.entry, "copy")}
          onCopyPath={() => void handleCopyEntryPath(showContextMenu.entry)}
          onCut={() => setClipboardFromEntry(showContextMenu.entry, "move")}
          onDeletePermanently={() => {
            void handleDeleteFromTrash(showContextMenu.entry);
          }}
          onDownload={() => handleDownloadEntry(showContextMenu.entry)}
          onGetInfo={() => {
            void handleGetInfo(showContextMenu.entry);
          }}
          onMoveToTrash={() => {
            void handleMoveSelectedToTrash(showContextMenu.entry);
          }}
          onOpen={() => navigateTo(showContextMenu.entry)}
          onPaste={() => {
            const destinationPath =
              showContextMenu.entry.type === "folder"
                ? showContextMenu.entry.path
                : toFilePath(currentPath);
            void handlePasteToDestination(destinationPath);
          }}
          onRename={() => {
            void handleRenameEntry(showContextMenu.entry);
          }}
          onRestore={() => {
            void handleRestoreFromTrash(showContextMenu.entry);
          }}
          onToggleShare={() => {
            if (contextShare) {
              void handleUnshareFolder(contextShare.id);
              return;
            }
            if (
              showContextMenu.entry.path === "Shared" ||
              showContextMenu.entry.path.startsWith("Shared/") ||
              showContextMenu.entry.path === "Network" ||
              showContextMenu.entry.path.startsWith("Network/")
            ) {
              setStatusNotice("Cannot share this folder path");
              return;
            }
            void handleShareFolder(showContextMenu.entry);
          }}
          onToggleStar={() => {
            void handleToggleStar(showContextMenu.entry);
          }}
        />
      ) : null}

      {createEntryDialog ? (
        <CreateEntryDialog
          dialog={createEntryDialog}
          isCreatePending={
            createFolderMutation.isPending || createFileMutation.isPending
          }
          onClose={closeCreateEntryDialog}
          onDialogChange={(value) =>
            setCreateEntryDialog((previous) =>
              previous ? { ...previous, name: value, error: null } : previous,
            )
          }
          onSubmit={() => {
            void submitCreateEntryDialog();
          }}
        />
      ) : null}

      {renameDialog ? (
        <RenameEntryDialog
          dialog={renameDialog}
          isRenamePending={renameFileEntryMutation.isPending}
          onClose={closeRenameDialog}
          onDialogChange={(value) =>
            setRenameDialog((previous) =>
              previous ? { ...previous, name: value, error: null } : previous,
            )
          }
          onSubmit={() => {
            void submitRenameDialog();
          }}
        />
      ) : null}

      {showEmptyTrashConfirm ? (
        <EmptyTrashConfirmDialog
          itemCount={trashItemCount}
          onCancel={() => setShowEmptyTrashConfirm(false)}
          onConfirm={() => {
            void confirmEmptyTrash();
          }}
        />
      ) : null}

      {fileInfoDialog ? (
        <FileInfoDialogOverlay
          fileInfo={fileInfoDialog}
          onClose={() => setFileInfoDialog(null)}
        />
      ) : null}

      <NetworkStorageDialog
        isOpen={showNetworkDialog}
        onClose={() => setShowNetworkDialog(false)}
        onNavigateToNetwork={() => {
          setShowNetworkDialog(false);
          navigateToPath(["Network"]);
        }}
      />
    </div>
  );
}
