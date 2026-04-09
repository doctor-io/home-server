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
  PasteConflictDialog,
  RenameEntryDialog,
} from "@/modules/files/components/file-manager-dialogs";
import { FileManagerBackgroundContextMenu, FileManagerContextMenu } from "@/modules/files/components/file-manager-overlays";
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
  type FilePasteCollision,
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
import { useEffect, useEffectEvent, useMemo, useReducer, useRef } from "react";
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

// --- Types ---

type ViewMode = "grid" | "list";
type SortBy = "name" | "modified" | "size";
type OpenFileState = { path: string[]; entry: FileEntry };
type ClipboardState = {
  sourcePaths: string[];
  names: string[];
  operation: "copy" | "move";
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
type PasteConflictState = {
  /** Remaining source paths yet to be processed */
  pendingSourcePaths: string[];
  /** Name of the conflicting file */
  conflictName: string;
  destinationPath: string;
  operation: "copy" | "move";
};

// --- State ---

type FileManagerState = {
  currentPath: string[];
  viewMode: ViewMode;
  selectedFile: string | null;
  selectedFiles: Set<string>;
  searchQuery: string;
  debouncedSearchQuery: string;
  sortBy: SortBy;
  sortDir: "asc" | "desc";
  showContextMenu: { x: number; y: number; entry: FileEntry } | null;
  showBackgroundContextMenu: { x: number; y: number } | null;
  openFile: OpenFileState | null;
  fileDrafts: Record<string, string>;
  editorNotice: string | null;
  statusNotice: string | null;
  showNetworkDialog: boolean;
  clipboardState: ClipboardState | null;
  isEmptyingTrash: boolean;
  includeHidden: boolean;
  createEntryDialog: CreateEntryDialogState | null;
  renameDialog: RenameDialogState | null;
  fileInfoDialog: FileInfoResponse | null;
  pendingEntryPath: string | null;
  showEmptyTrashConfirm: boolean;
  isDragOver: boolean;
  globalSearch: boolean;
  uploadProgress: { loaded: number; total: number } | null;
  pasteConflict: PasteConflictState | null;
  searchDisplayLimit: number;
};

const SEARCH_DISPLAY_LIMIT = 100;

const initialState: FileManagerState = {
  currentPath: [],
  viewMode: "grid",
  selectedFile: null,
  selectedFiles: new Set(),
  searchQuery: "",
  debouncedSearchQuery: "",
  sortBy: "name",
  sortDir: "asc",
  showContextMenu: null,
  showBackgroundContextMenu: null,
  openFile: null,
  fileDrafts: {},
  editorNotice: null,
  statusNotice: null,
  showNetworkDialog: false,
  clipboardState: null,
  isEmptyingTrash: false,
  includeHidden: false,
  createEntryDialog: null,
  renameDialog: null,
  fileInfoDialog: null,
  pendingEntryPath: null,
  showEmptyTrashConfirm: false,
  isDragOver: false,
  globalSearch: false,
  uploadProgress: null,
  pasteConflict: null,
  searchDisplayLimit: SEARCH_DISPLAY_LIMIT,
};

// --- Actions ---

type Action =
  | { type: "NAVIGATE_TO_PATH"; path: string[] }
  | { type: "NAVIGATE_UP" }
  | { type: "SET_VIEW_MODE"; mode: ViewMode }
  | { type: "SELECT_FILE"; name: string | null }
  | { type: "SET_SELECTED_FILES"; files: Set<string> }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_DEBOUNCED_SEARCH_QUERY"; query: string }
  | { type: "SET_SORT_BY"; by: SortBy }
  | { type: "TOGGLE_SORT_DIR" }
  | { type: "SHOW_CONTEXT_MENU"; x: number; y: number; entry: FileEntry }
  | { type: "HIDE_CONTEXT_MENU" }
  | { type: "SHOW_BACKGROUND_CONTEXT_MENU"; x: number; y: number }
  | { type: "HIDE_BACKGROUND_CONTEXT_MENU" }
  | { type: "OPEN_FILE"; path: string[]; entry: FileEntry }
  | { type: "CLOSE_FILE" }
  | { type: "SET_FILE_DRAFT"; key: string; value: string }
  | { type: "INIT_FILE_DRAFT"; key: string; value: string }
  | { type: "SET_EDITOR_NOTICE"; notice: string | null }
  | { type: "SET_STATUS_NOTICE"; notice: string | null }
  | { type: "SHOW_NETWORK_DIALOG" }
  | { type: "HIDE_NETWORK_DIALOG" }
  | { type: "SET_CLIPBOARD"; sourcePaths: string[]; names: string[]; operation: "copy" | "move" }
  | { type: "CLEAR_CLIPBOARD" }
  | { type: "SET_IS_EMPTYING_TRASH"; value: boolean }
  | { type: "TOGGLE_INCLUDE_HIDDEN" }
  | { type: "OPEN_CREATE_ENTRY_DIALOG"; kind: "file" | "folder" }
  | { type: "CLOSE_CREATE_ENTRY_DIALOG" }
  | { type: "UPDATE_CREATE_ENTRY_DIALOG"; name: string; error: string | null }
  | { type: "SET_CREATE_ENTRY_ERROR"; error: string }
  | { type: "OPEN_RENAME_DIALOG"; entry: FileEntry }
  | { type: "CLOSE_RENAME_DIALOG" }
  | { type: "UPDATE_RENAME_DIALOG"; name: string; error: string | null }
  | { type: "SET_RENAME_ERROR"; error: string }
  | { type: "OPEN_FILE_INFO_DIALOG"; info: FileInfoResponse }
  | { type: "CLOSE_FILE_INFO_DIALOG" }
  | { type: "SET_PENDING_ENTRY_PATH"; path: string | null }
  | { type: "SHOW_EMPTY_TRASH_CONFIRM" }
  | { type: "HIDE_EMPTY_TRASH_CONFIRM" }
  | { type: "SET_DRAG_OVER"; value: boolean }
  | { type: "TOGGLE_GLOBAL_SEARCH" }
  | { type: "SET_UPLOAD_PROGRESS"; loaded: number; total: number }
  | { type: "CLEAR_UPLOAD_PROGRESS" }
  | { type: "SHOW_PASTE_CONFLICT"; conflict: PasteConflictState }
  | { type: "HIDE_PASTE_CONFLICT" }
  | { type: "LOAD_MORE_SEARCH" };

function reducer(state: FileManagerState, action: Action): FileManagerState {
  switch (action.type) {
    case "NAVIGATE_TO_PATH":
      return {
        ...state,
        currentPath: action.path,
        selectedFile: null,
        selectedFiles: new Set(),
        searchQuery: "",
        openFile: null,
        statusNotice: null,
        showContextMenu: null,
        showBackgroundContextMenu: null,
        searchDisplayLimit: SEARCH_DISPLAY_LIMIT,
      };
    case "NAVIGATE_UP":
      return {
        ...state,
        currentPath: state.currentPath.slice(0, -1),
        selectedFile: null,
        selectedFiles: new Set(),
        openFile: null,
        showContextMenu: null,
        showBackgroundContextMenu: null,
      };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.mode };
    case "SELECT_FILE":
      return { ...state, selectedFile: action.name };
    case "SET_SELECTED_FILES":
      return { ...state, selectedFiles: action.files };
    case "CLEAR_SELECTION":
      return { ...state, selectedFile: null, selectedFiles: new Set() };
    case "SET_SEARCH_QUERY":
      return { ...state, searchQuery: action.query, searchDisplayLimit: SEARCH_DISPLAY_LIMIT };
    case "SET_DEBOUNCED_SEARCH_QUERY":
      return { ...state, debouncedSearchQuery: action.query };
    case "SET_SORT_BY":
      return { ...state, sortBy: action.by, sortDir: "asc" };
    case "TOGGLE_SORT_DIR":
      return { ...state, sortDir: state.sortDir === "asc" ? "desc" : "asc" };
    case "SHOW_CONTEXT_MENU":
      return {
        ...state,
        showContextMenu: { x: action.x, y: action.y, entry: action.entry },
        showBackgroundContextMenu: null,
      };
    case "HIDE_CONTEXT_MENU":
      return { ...state, showContextMenu: null };
    case "SHOW_BACKGROUND_CONTEXT_MENU":
      return {
        ...state,
        showBackgroundContextMenu: { x: action.x, y: action.y },
        showContextMenu: null,
      };
    case "HIDE_BACKGROUND_CONTEXT_MENU":
      return { ...state, showBackgroundContextMenu: null };
    case "OPEN_FILE":
      return {
        ...state,
        openFile: { path: action.path, entry: action.entry },
        selectedFile: action.entry.name,
        selectedFiles: new Set([action.entry.name]),
        editorNotice: null,
      };
    case "CLOSE_FILE":
      return { ...state, openFile: null };
    case "SET_FILE_DRAFT":
      return { ...state, fileDrafts: { ...state.fileDrafts, [action.key]: action.value } };
    case "INIT_FILE_DRAFT":
      if (state.fileDrafts[action.key] !== undefined) return state;
      return { ...state, fileDrafts: { ...state.fileDrafts, [action.key]: action.value } };
    case "SET_EDITOR_NOTICE":
      return { ...state, editorNotice: action.notice };
    case "SET_STATUS_NOTICE":
      return { ...state, statusNotice: action.notice };
    case "SHOW_NETWORK_DIALOG":
      return { ...state, showNetworkDialog: true };
    case "HIDE_NETWORK_DIALOG":
      return { ...state, showNetworkDialog: false };
    case "SET_CLIPBOARD":
      return {
        ...state,
        clipboardState: {
          sourcePaths: action.sourcePaths,
          names: action.names,
          operation: action.operation,
        },
      };
    case "CLEAR_CLIPBOARD":
      return { ...state, clipboardState: null };
    case "SET_IS_EMPTYING_TRASH":
      return { ...state, isEmptyingTrash: action.value };
    case "TOGGLE_INCLUDE_HIDDEN":
      return { ...state, includeHidden: !state.includeHidden };
    case "OPEN_CREATE_ENTRY_DIALOG":
      return { ...state, createEntryDialog: { kind: action.kind, name: "", error: null } };
    case "CLOSE_CREATE_ENTRY_DIALOG":
      return { ...state, createEntryDialog: null };
    case "UPDATE_CREATE_ENTRY_DIALOG":
      if (!state.createEntryDialog) return state;
      return { ...state, createEntryDialog: { ...state.createEntryDialog, name: action.name, error: action.error } };
    case "SET_CREATE_ENTRY_ERROR":
      if (!state.createEntryDialog) return state;
      return { ...state, createEntryDialog: { ...state.createEntryDialog, error: action.error } };
    case "OPEN_RENAME_DIALOG":
      return { ...state, renameDialog: { entry: action.entry, name: action.entry.name, error: null } };
    case "CLOSE_RENAME_DIALOG":
      return { ...state, renameDialog: null };
    case "UPDATE_RENAME_DIALOG":
      if (!state.renameDialog) return state;
      return { ...state, renameDialog: { ...state.renameDialog, name: action.name, error: action.error } };
    case "SET_RENAME_ERROR":
      if (!state.renameDialog) return state;
      return { ...state, renameDialog: { ...state.renameDialog, error: action.error } };
    case "OPEN_FILE_INFO_DIALOG":
      return { ...state, fileInfoDialog: action.info };
    case "CLOSE_FILE_INFO_DIALOG":
      return { ...state, fileInfoDialog: null };
    case "SET_PENDING_ENTRY_PATH":
      return { ...state, pendingEntryPath: action.path };
    case "SHOW_EMPTY_TRASH_CONFIRM":
      return { ...state, showEmptyTrashConfirm: true };
    case "HIDE_EMPTY_TRASH_CONFIRM":
      return { ...state, showEmptyTrashConfirm: false };
    case "SET_DRAG_OVER":
      return { ...state, isDragOver: action.value };
    case "TOGGLE_GLOBAL_SEARCH":
      return { ...state, globalSearch: !state.globalSearch, searchDisplayLimit: SEARCH_DISPLAY_LIMIT };
    case "SET_UPLOAD_PROGRESS":
      return { ...state, uploadProgress: { loaded: action.loaded, total: action.total } };
    case "CLEAR_UPLOAD_PROGRESS":
      return { ...state, uploadProgress: null };
    case "SHOW_PASTE_CONFLICT":
      return { ...state, pasteConflict: action.conflict };
    case "HIDE_PASTE_CONFLICT":
      return { ...state, pasteConflict: null };
    case "LOAD_MORE_SEARCH":
      return { ...state, searchDisplayLimit: state.searchDisplayLimit + SEARCH_DISPLAY_LIMIT };
    default:
      return state;
  }
}

// --- Component ---

export function FileManager() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(reducer, initialState);
  const statusNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    currentPath,
    viewMode,
    selectedFile,
    selectedFiles,
    searchQuery,
    debouncedSearchQuery,
    sortBy,
    sortDir,
    showContextMenu,
    showBackgroundContextMenu,
    openFile,
    fileDrafts,
    editorNotice,
    statusNotice,
    showNetworkDialog,
    clipboardState,
    isEmptyingTrash,
    includeHidden,
    createEntryDialog,
    renameDialog,
    fileInfoDialog,
    pendingEntryPath,
    showEmptyTrashConfirm,
    isDragOver,
    globalSearch,
    uploadProgress,
    pasteConflict,
    searchDisplayLimit,
  } = state;

  function setStatusNotice(msg: string | null) {
    if (statusNoticeTimerRef.current) clearTimeout(statusNoticeTimerRef.current);
    dispatch({ type: "SET_STATUS_NOTICE", notice: msg });
    if (msg !== null) {
      statusNoticeTimerRef.current = setTimeout(() => dispatch({ type: "SET_STATUS_NOTICE", notice: null }), 4000);
    }
  }

  const isStarredView = currentPath.length === 1 && currentPath[0] === STARRED_VIRTUAL_PATH[0];
  const isTrashView = currentPath[0] === "Trash";
  const isSharedView = currentPath[0] === "Shared";

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

  const openFilePath = openFile ? toFilePath(openFile.path) : null;
  const fileContentQuery = useFileContent(openFilePath);
  const globalSearchQuery = useSearchFiles({
    query: debouncedSearchQuery,
    basePath: undefined,
    includeHidden,
    enabled: globalSearch && debouncedSearchQuery.trim().length >= 2,
  });

  const isGlobalSearchActive = globalSearch && debouncedSearchQuery.trim().length >= 2;

  // Search debounce
  useEffect(() => {
    const id = setTimeout(() => dispatch({ type: "SET_DEBOUNCED_SEARCH_QUERY", query: searchQuery }), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

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

    if (searchQuery && !isGlobalSearchActive) {
      entries = entries.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    const folders = entries.filter((e) => e.type === "folder");
    const files = entries.filter((e) => e.type === "file");

    const dir = sortDir === "asc" ? 1 : -1;
    const sortFn = (a: FileEntry, b: FileEntry) => {
      if (sortBy === "name") return dir * a.name.localeCompare(b.name);
      if (sortBy === "modified") {
        return dir * (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime());
      }
      if (sortBy === "size") return dir * ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0));
      return 0;
    };

    return [...folders.sort(sortFn), ...files.sort(sortFn)];
  }, [currentEntries, isGlobalSearchActive, searchQuery, sortBy, sortDir]);

  // Search result limit
  const visibleEntries = isGlobalSearchActive
    ? sortedEntries.slice(0, searchDisplayLimit)
    : sortedEntries;
  const hasMoreSearchResults = isGlobalSearchActive && sortedEntries.length > searchDisplayLimit;

  const openFileKey = openFilePath;
  const openFileLanguage = openFile ? getEditorLanguage(openFile.entry) : "plaintext";
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
    const map = new Map<string, { id: string; shareName: string; sourcePath: string; sharedPath: string; isMounted: boolean; isExported: boolean }>();
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
      if (!hostSegment || !rootSegment) continue;
      if (hostSegment) hosts.set(hostSegment, [rootSegment, hostSegment]);
    }
    return Array.from(hosts.entries())
      .sort(([l], [r]) => l.localeCompare(r))
      .map(([host, hostPath]) => ({
        name: host,
        icon: <HardDriveRegular className="size-4 text-cyan-400" />,
        path: hostPath,
      }));
  }, [networkSharesQuery.data]);

  // Init file draft when file opens
  useEffect(() => {
    if (!openFileKey || !openFileViewer || openFileViewer.mode !== "text") return;
    dispatch({ type: "INIT_FILE_DRAFT", key: openFileKey, value: openFileViewer.content ?? "" });
  }, [openFileKey, openFileViewer]);

  // Clear editor notice on file change
  useEffect(() => {
    dispatch({ type: "SET_EDITOR_NOTICE", notice: null });
  }, [openFileKey]);

  // useEffectEvent handlers for keyboard shortcut effect
  const navigateToEvent = useEffectEvent((entry: FileEntry) => navigateTo(entry));
  const navigateUpEvent = useEffectEvent(() => navigateUp());
  const deleteFromTrashEvent = useEffectEvent((entry: FileEntry) => { void handleDeleteFromTrash(entry); });
  const moveToTrashEvent = useEffectEvent((entry: FileEntry) => { void handleMoveSelectedToTrash(entry); });
  const renameEntryEvent = useEffectEvent((entry: FileEntry) => handleRenameEntry(entry));
  const copyEntryEvent = useEffectEvent((entries: FileEntry[], op: "copy" | "move") => {
    setClipboardFromEntries(entries, op);
  });
  const pasteEvent = useEffectEvent((destPath: string) => { void handlePasteToDestination(destPath); });

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (createEntryDialog || renameDialog || fileInfoDialog || showEmptyTrashConfirm || showContextMenu || pasteConflict) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (openFile) {
          dispatch({ type: "CLOSE_FILE" });
        } else if (selectedFile || selectedFiles.size > 0) {
          dispatch({ type: "CLEAR_SELECTION" });
        } else if (searchQuery) {
          dispatch({ type: "SET_SEARCH_QUERY", query: "" });
        }
        return;
      }

      if (openFile) return;

      const entries = sortedEntries;
      if (entries.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = selectedFile ? entries.findIndex((en) => en.name === selectedFile) : -1;
        const nextIdx = e.key === "ArrowDown"
          ? Math.min(currentIdx + 1, entries.length - 1)
          : Math.max(currentIdx - 1, 0);
        dispatch({ type: "SELECT_FILE", name: entries[nextIdx].name });
        dispatch({ type: "SET_SELECTED_FILES", files: new Set([entries[nextIdx].name]) });
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
        const toDelete = selectedFiles.size > 0 ? [...selectedFiles] : selectedFile ? [selectedFile] : [];
        if (toDelete.length === 0) return;
        e.preventDefault();
        for (const name of toDelete) {
          const entry = entries.find((en) => en.name === name);
          if (!entry) continue;
          if (isTrashView) deleteFromTrashEvent(entry);
          else moveToTrashEvent(entry);
        }
        return;
      }

      if (e.key === "F2") {
        if (!selectedFile || isTrashView) return;
        const entry = entries.find((en) => en.name === selectedFile);
        if (!entry) return;
        e.preventDefault();
        renameEntryEvent(entry);
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        dispatch({ type: "SET_SELECTED_FILES", files: new Set(entries.map((en) => en.name)) });
        if (entries.length > 0) dispatch({ type: "SELECT_FILE", name: entries[0].name });
        return;
      }

      if (e.key === "c" || e.key === "C") {
        if (isTrashView) return;
        const selected = selectedFiles.size > 0
          ? entries.filter((en) => selectedFiles.has(en.name))
          : selectedFile
            ? entries.filter((en) => en.name === selectedFile)
            : [];
        if (selected.length === 0) return;
        e.preventDefault();
        copyEntryEvent(selected, "copy");
        return;
      }

      if (e.key === "x" || e.key === "X") {
        if (isTrashView) return;
        const selected = selectedFiles.size > 0
          ? entries.filter((en) => selectedFiles.has(en.name))
          : selectedFile
            ? entries.filter((en) => en.name === selectedFile)
            : [];
        if (selected.length === 0) return;
        e.preventDefault();
        copyEntryEvent(selected, "move");
        return;
      }

      if (e.key === "v" || e.key === "V") {
        if (!clipboardState || isTrashView) return;
        e.preventDefault();
        pasteEvent(toFilePath(currentPath));
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
    clipboardState,
    createEntryDialog,
    renameDialog,
    fileInfoDialog,
    showEmptyTrashConfirm,
    showContextMenu,
    pasteConflict,
    navigateToEvent,
    navigateUpEvent,
    deleteFromTrashEvent,
    moveToTrashEvent,
    renameEntryEvent,
    copyEntryEvent,
    pasteEvent,
  ]);

  // --- Navigation ---

  function navigateTo(entry: FileEntry) {
    if (entry.type === "folder") {
      dispatch({ type: "NAVIGATE_TO_PATH", path: entry.path.split("/").filter(Boolean) });
      return;
    }
    dispatch({ type: "OPEN_FILE", path: entry.path.split("/").filter(Boolean), entry });
  }

  function navigateToPath(pathSegments: string[]) {
    dispatch({ type: "NAVIGATE_TO_PATH", path: normalizePathForBackend(pathSegments) });
  }

  function navigateUp() {
    dispatch({ type: "NAVIGATE_UP" });
  }

  // --- Selection ---

  function handleEntryClick(e: React.MouseEvent, entry: FileEntry) {
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedFiles);
      if (next.has(entry.name)) next.delete(entry.name);
      else next.add(entry.name);
      dispatch({ type: "SET_SELECTED_FILES", files: next });
      dispatch({ type: "SELECT_FILE", name: entry.name });
    } else if (e.shiftKey && selectedFile) {
      const anchorIdx = sortedEntries.findIndex((en) => en.name === selectedFile);
      const clickedIdx = sortedEntries.findIndex((en) => en.name === entry.name);
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [from, to] = anchorIdx <= clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx];
        dispatch({ type: "SET_SELECTED_FILES", files: new Set(sortedEntries.slice(from, to + 1).map((en) => en.name)) });
      }
      dispatch({ type: "SELECT_FILE", name: entry.name });
    } else {
      dispatch({ type: "SET_SELECTED_FILES", files: new Set([entry.name]) });
      dispatch({ type: "SELECT_FILE", name: entry.name });
    }
  }

  // --- Trash actions ---

  async function handleTrashSelected() {
    const names = [...selectedFiles];
    if (names.length === 0) return;
    dispatch({ type: "CLEAR_SELECTION" });
    for (const name of names) {
      const entry = sortedEntries.find((en) => en.name === name);
      if (!entry) continue;
      try {
        await moveToTrashMutation.mutateAsync({ path: entry.path });
      } catch { /* individual errors handled by mutation */ }
    }
  }

  async function handleMoveSelectedToTrash(entry: FileEntry) {
    dispatch({ type: "SET_PENDING_ENTRY_PATH", path: entry.path });
    try {
      const result = await moveToTrashMutation.mutateAsync({ path: entry.path });
      if (openFile && toFilePath(openFile.path) === entry.path) dispatch({ type: "CLOSE_FILE" });
      dispatch({ type: "SELECT_FILE", name: null });
      setStatusNotice(`Moved to Trash: ${result.trashPath}`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to move item to Trash");
    } finally {
      dispatch({ type: "SET_PENDING_ENTRY_PATH", path: null });
    }
  }

  async function handleRestoreFromTrash(entry: FileEntry) {
    dispatch({ type: "SET_PENDING_ENTRY_PATH", path: entry.path });
    try {
      const result = await restoreFromTrashMutation.mutateAsync({ path: entry.path, collision: "keep-both" });
      dispatch({ type: "SELECT_FILE", name: null });
      setStatusNotice(`Restored: ${result.restoredPath}`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to restore item from Trash");
    } finally {
      dispatch({ type: "SET_PENDING_ENTRY_PATH", path: null });
    }
  }

  async function handleDeleteFromTrash(entry: FileEntry) {
    dispatch({ type: "SET_PENDING_ENTRY_PATH", path: entry.path });
    try {
      await deleteFromTrashMutation.mutateAsync({ path: entry.path });
      dispatch({ type: "SELECT_FILE", name: null });
      setStatusNotice(`Deleted permanently: ${entry.name}`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to permanently delete item");
    } finally {
      dispatch({ type: "SET_PENDING_ENTRY_PATH", path: null });
    }
  }

  // --- Empty trash ---

  function handleEmptyTrash() {
    const totalCount = directoryQuery.data?.entries.length ?? currentEntries.length;
    if (!isTrashView || totalCount === 0 || isEmptyingTrash) return;
    dispatch({ type: "SHOW_EMPTY_TRASH_CONFIRM" });
  }

  async function confirmEmptyTrash() {
    dispatch({ type: "HIDE_EMPTY_TRASH_CONFIRM" });
    dispatch({ type: "SET_IS_EMPTYING_TRASH", value: true });
    try {
      const result = await emptyTrashMutation.mutateAsync();
      setStatusNotice(`Trash emptied (${result.deletedCount} item${result.deletedCount !== 1 ? "s" : ""})`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to empty Trash");
    } finally {
      dispatch({ type: "SET_IS_EMPTYING_TRASH", value: false });
    }
  }

  // --- Create entry ---

  async function handleCreateEntry(kind: "file" | "folder", name: string) {
    const normalizedName = name.trim();
    if (normalizedName.length === 0) throw new Error(`Invalid ${kind} name`);
    const parentPath = toFilePath(currentPath);
    const result =
      kind === "folder"
        ? await createFolderMutation.mutateAsync({ parentPath, name: normalizedName })
        : await createFileMutation.mutateAsync({ parentPath, name: normalizedName });
    setStatusNotice(`${kind === "folder" ? "Folder" : "File"} created: ${result.path}`);
  }

  async function submitCreateEntryDialog() {
    if (!createEntryDialog) return;
    const kind = createEntryDialog.kind;
    try {
      await handleCreateEntry(kind, createEntryDialog.name);
      dispatch({ type: "CLOSE_CREATE_ENTRY_DIALOG" });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to create ${kind}`;
      dispatch({ type: "SET_CREATE_ENTRY_ERROR", error: message });
      setStatusNotice(message);
    }
  }

  // --- Clipboard / Paste ---

  function setClipboardFromEntries(entries: FileEntry[], operation: "copy" | "move") {
    dispatch({
      type: "SET_CLIPBOARD",
      sourcePaths: entries.map((e) => e.path),
      names: entries.map((e) => e.name),
      operation,
    });
    const label = entries.length === 1 ? entries[0].name : `${entries.length} items`;
    setStatusNotice(`${operation === "copy" ? "Copied" : "Cut"}: ${label}`);
  }

  async function handlePasteToDestination(destinationPath: string, collision?: FilePasteCollision) {
    if (!clipboardState) {
      setStatusNotice("Clipboard is empty");
      return;
    }

    const sourcePaths = clipboardState.sourcePaths;
    let successCount = 0;

    for (const sourcePath of sourcePaths) {
      try {
        await pasteFileEntryMutation.mutateAsync({
          sourcePath,
          destinationPath,
          operation: clipboardState.operation,
          collision,
        });
        successCount++;
      } catch (error) {
        const isConflict = error instanceof Error && error.message.toLowerCase().includes("destination already exists");
        if (isConflict && !collision) {
          const name = sourcePath.split("/").pop() ?? sourcePath;
          // Show conflict dialog with remaining paths (including current)
          const remainingIdx = sourcePaths.indexOf(sourcePath);
          dispatch({
            type: "SHOW_PASTE_CONFLICT",
            conflict: {
              pendingSourcePaths: sourcePaths.slice(remainingIdx),
              conflictName: name,
              destinationPath,
              operation: clipboardState.operation,
            },
          });
          return; // stop processing; user will decide
        }
        setStatusNotice(error instanceof Error ? error.message : "Paste failed");
        return;
      }
    }

    const label = successCount === 1
      ? clipboardState.names[0] ?? "item"
      : `${successCount} items`;
    setStatusNotice(`${clipboardState.operation === "copy" ? "Copied" : "Moved"}: ${label}`);

    if (clipboardState.operation === "move") {
      dispatch({ type: "CLEAR_CLIPBOARD" });
      if (openFile && clipboardState.sourcePaths.includes(toFilePath(openFile.path))) {
        dispatch({ type: "CLOSE_FILE" });
      }
    }
  }

  async function handleConflictResolution(choice: FilePasteCollision | "skip-all") {
    if (!pasteConflict) return;
    dispatch({ type: "HIDE_PASTE_CONFLICT" });

    if (choice === "skip-all") return;

    const { pendingSourcePaths, destinationPath, operation } = pasteConflict;

    if (!clipboardState) return;
    const allSourcePaths = clipboardState.sourcePaths;
    let successCount = 0;

    for (const sourcePath of pendingSourcePaths) {
      try {
        const effectiveCollision: FilePasteCollision = choice === "skip" ? "skip" : choice;
        await pasteFileEntryMutation.mutateAsync({
          sourcePath,
          destinationPath,
          operation,
          collision: effectiveCollision,
        });
        successCount++;
      } catch (error) {
        setStatusNotice(error instanceof Error ? error.message : "Paste failed");
        return;
      }
    }

    const processedBefore = allSourcePaths.length - pendingSourcePaths.length;
    const total = processedBefore + successCount;
    const label = total === 1 ? (clipboardState.names[0] ?? "item") : `${total} items`;
    setStatusNotice(`${operation === "copy" ? "Copied" : "Moved"}: ${label}`);

    if (operation === "move") {
      dispatch({ type: "CLEAR_CLIPBOARD" });
      if (openFile && clipboardState.sourcePaths.includes(toFilePath(openFile.path))) {
        dispatch({ type: "CLOSE_FILE" });
      }
    }
  }

  // --- Rename ---

  function handleRenameEntry(entry: FileEntry) {
    if (isTrashView) {
      setStatusNotice("Rename is disabled in Trash");
      return;
    }
    dispatch({ type: "OPEN_RENAME_DIALOG", entry });
  }

  async function submitRenameDialog() {
    if (!renameDialog) return;
    const newName = renameDialog.name.trim();
    if (!newName || newName === renameDialog.entry.name) {
      dispatch({ type: "CLOSE_RENAME_DIALOG" });
      return;
    }
    try {
      const result = await renameFileEntryMutation.mutateAsync({ path: renameDialog.entry.path, newName });
      dispatch({ type: "CLOSE_RENAME_DIALOG" });
      dispatch({ type: "SELECT_FILE", name: null });
      setStatusNotice(`Renamed to ${result.path.split("/").pop() ?? newName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to rename item";
      dispatch({ type: "SET_RENAME_ERROR", error: message });
    }
  }

  // --- Get info ---

  async function handleGetInfo(entry: FileEntry) {
    try {
      const info = await getFileInfoMutation.mutateAsync(entry.path);
      dispatch({ type: "OPEN_FILE_INFO_DIALOG", info });
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to get item info");
    }
  }

  // --- Star ---

  async function handleToggleStar(entry: FileEntry) {
    try {
      const result = await toggleStarMutation.mutateAsync(entry.path);
      setStatusNotice(result.starred ? `Starred ${entry.name}` : `Unstarred ${entry.name}`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to toggle star");
    }
  }

  // --- Upload ---

  async function handleUploadFiles(files: File[]) {
    if (files.length === 0 || isTrashView || isStarredView) return;
    const destinationPath = toFilePath(currentPath);
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    try {
      const result = await uploadFilesMutation.mutateAsync({
        destinationPath,
        files,
        includeHidden,
        onProgress: (loaded, total) => {
          dispatch({ type: "SET_UPLOAD_PROGRESS", loaded, total: total || totalSize });
        },
      });
      dispatch({ type: "CLEAR_UPLOAD_PROGRESS" });
      const uploaded = result.uploaded.length;
      const skipped = result.skipped.length;
      if (uploaded > 0 && skipped === 0) {
        setStatusNotice(`Uploaded ${uploaded} file${uploaded !== 1 ? "s" : ""}`);
      } else if (uploaded > 0) {
        setStatusNotice(`Uploaded ${uploaded}, skipped ${skipped} (already exist)`);
      } else {
        setStatusNotice(`Skipped ${skipped} file${skipped !== 1 ? "s" : ""} (already exist)`);
      }
    } catch (error) {
      dispatch({ type: "CLEAR_UPLOAD_PROGRESS" });
      setStatusNotice(error instanceof Error ? error.message : "Upload failed");
    }
  }

  // --- Download ---

  function handleDownloadEntry(entry: FileEntry) {
    if (entry.type === "folder") {
      window.open(buildZipUrl(entry.path), "_blank", "noopener,noreferrer");
      return;
    }
    window.open(buildDownloadUrl(entry.path), "_blank", "noopener,noreferrer");
  }

  // --- Share ---

  async function handleShareFolder(entry: FileEntry) {
    try {
      const result = await createLocalShareMutation.mutateAsync({ path: entry.path });
      setStatusNotice(`Shared over network: /${result.sharedPath}`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to share folder");
    }
  }

  async function handleUnshareFolder(shareId: string) {
    try {
      await deleteLocalShareMutation.mutateAsync(shareId);
      setStatusNotice("Shared folder removed");
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to remove shared folder");
    }
  }

  // --- Copy path ---

  async function handleCopyEntryPath(entry: FileEntry) {
    const hostname = systemMetricsQuery.data?.hostname ?? "";
    const networkAddress = systemMetricsQuery.data?.wifi?.ipv4 ?? hostname;
    const absolutePath = filesRootPath ? `${filesRootPath}/${entry.path}` : `/${entry.path}`;
    const fullPath =
      entry.path === "Shared" || entry.path.startsWith("Shared/")
        ? networkAddress ? `smb://${networkAddress}${absolutePath}` : absolutePath
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
      toast.error("Could not copy automatically", { description: fullPath });
    }
  }

  // --- Save file ---

  async function handleSaveOpenFile() {
    if (!openFileKey || !openFileViewer || openFileViewer.mode !== "text") return;
    const nextContent = fileDrafts[openFileKey] ?? openFileViewer.content ?? "";
    try {
      await saveFileContentMutation.mutateAsync({
        path: openFileKey,
        content: nextContent,
        expectedMtimeMs: openFileViewer.mtimeMs,
      });
      dispatch({ type: "SET_EDITOR_NOTICE", notice: "Saved" });
    } catch (error) {
      dispatch({ type: "SET_EDITOR_NOTICE", notice: error instanceof Error ? error.message : "Failed to save file" });
    }
  }

  // --- Context menus ---

  function handleContextMenu(e: React.MouseEvent, entry: FileEntry) {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 220;
    const menuHeight = 260;
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!rootRect) return;
    const x = Math.min(Math.max(8, e.clientX - rootRect.left), rootRect.width - menuWidth - 8);
    const y = Math.min(Math.max(8, e.clientY - rootRect.top), rootRect.height - menuHeight - 8);
    dispatch({ type: "SHOW_CONTEXT_MENU", x, y, entry });
    dispatch({ type: "SELECT_FILE", name: entry.name });
  }

  function handleBackgroundContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const menuWidth = 176;
    const menuHeight = 112;
    const rootRect = rootRef.current?.getBoundingClientRect();
    if (!rootRect) return;
    const x = Math.min(Math.max(8, e.clientX - rootRect.left), rootRect.width - menuWidth - 8);
    const y = Math.min(Math.max(8, e.clientY - rootRect.top), rootRect.height - menuHeight - 8);
    dispatch({ type: "SHOW_BACKGROUND_CONTEXT_MENU", x, y });
  }

  // --- Derived ---

  const folderCount = sortedEntries.filter((e) => e.type === "folder").length;
  const fileCount = sortedEntries.filter((e) => e.type === "file").length;
  const contextShare =
    showContextMenu?.entry.type === "folder"
      ? localSharesByPath.get(showContextMenu.entry.path)
      : undefined;
  const trashItemCount = directoryQuery.data?.entries.length ?? currentEntries.length;
  const clipboardDisplayName = clipboardState
    ? clipboardState.names.length === 1
      ? clipboardState.names[0]
      : `${clipboardState.names.length} items`
    : null;

  return (
    <div
      ref={rootRef}
      className="relative flex h-full"
      onClick={() => {
        dispatch({ type: "HIDE_CONTEXT_MENU" });
        dispatch({ type: "HIDE_BACKGROUND_CONTEXT_MENU" });
      }}
    >
      <FileManagerSidebar
        currentPath={currentPath}
        isSharedView={isSharedView}
        isTrashView={isTrashView}
        locationItems={locationItems}
        sidebarSections={sidebarSections}
        storageUsagePercent={storageUsagePercent}
        storageUsageText={storageUsageText}
        onNavigateToPath={navigateToPath}
        onOpenNetworkDialog={() => dispatch({ type: "SHOW_NETWORK_DIALOG" })}
      />

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
          uploadProgress={uploadProgress}
          viewMode={viewMode}
          onCycleSortBy={() => {
            const next = sortBy === "name" ? "modified" : sortBy === "modified" ? "size" : "name";
            dispatch({ type: "SET_SORT_BY", by: next });
          }}
          onEmptyTrash={() => { void handleEmptyTrash(); }}
          onNavigateToPath={navigateToPath}
          onNavigateUp={navigateUp}
          onOpenCreateEntryDialog={(kind) => dispatch({ type: "OPEN_CREATE_ENTRY_DIALOG", kind })}
          onSearchQueryChange={(q) => dispatch({ type: "SET_SEARCH_QUERY", query: q })}
          onSetViewMode={(mode) => dispatch({ type: "SET_VIEW_MODE", mode })}
          onToggleGlobalSearch={() => dispatch({ type: "TOGGLE_GLOBAL_SEARCH" })}
          onToggleIncludeHidden={() => dispatch({ type: "TOGGLE_INCLUDE_HIDDEN" })}
          onToggleSortDir={() => dispatch({ type: "TOGGLE_SORT_DIR" })}
          onUploadInputChange={(files) => { void handleUploadFiles(files); }}
        />

        <FileManagerFileArea
          canSaveOpenFile={canSaveOpenFile}
          directoryErrorMessage={
            directoryQuery.error instanceof Error ? directoryQuery.error.message : "Failed to load files"
          }
          directoryIsError={directoryQuery.isError}
          directoryIsLoading={directoryQuery.isLoading}
          editorNotice={editorNotice}
          fileContentErrorMessage={
            fileContentQuery.error instanceof Error ? fileContentQuery.error.message : "Failed to open file"
          }
          fileContentIsError={fileContentQuery.isError}
          fileContentIsLoading={fileContentQuery.isLoading}
          globalSearchIsFetching={globalSearchQuery.isFetching}
          hasMoreSearchResults={hasMoreSearchResults}
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
          sortedEntries={visibleEntries}
          totalEntriesCount={sortedEntries.length}
          viewMode={viewMode}
          onChangeOpenFileDraft={(value) => {
            if (!openFileKey) return;
            dispatch({
              type: "SET_FILE_DRAFT",
              key: openFileKey,
              value: typeof value === "function" ? value(fileDrafts[openFileKey] ?? "") : value,
            });
          }}
          onCloseOpenFile={() => dispatch({ type: "CLOSE_FILE" })}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              dispatch({ type: "SET_DRAG_OVER", value: false });
            }
          }}
          onDragOver={(event) => {
            if (isTrashView || isStarredView) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            dispatch({ type: "SET_DRAG_OVER", value: true });
          }}
          onDrop={(event) => {
            event.preventDefault();
            dispatch({ type: "SET_DRAG_OVER", value: false });
            if (isTrashView || isStarredView) return;
            void handleUploadFiles(Array.from(event.dataTransfer.files));
          }}
          onBackgroundContextMenu={handleBackgroundContextMenu}
          onEntryClick={handleEntryClick}
          onEntryContextMenu={handleContextMenu}
          onOpenEntry={navigateTo}
          onLoadMoreSearch={() => dispatch({ type: "LOAD_MORE_SEARCH" })}
          onSaveOpenFile={() => { void handleSaveOpenFile(); }}
        />

        <FileManagerStatusBar
          clipboardName={clipboardDisplayName}
          clipboardOperation={clipboardState?.operation ?? null}
          currentPathForDisplay={currentPathForDisplay}
          fileCount={fileCount}
          folderCount={folderCount}
          isStarredView={isStarredView}
          isTrashView={isTrashView}
          rootLabel={rootLabel}
          selectedFilesCount={selectedFiles.size}
          statusNotice={statusNotice}
          onTrashSelected={() => { void handleTrashSelected(); }}
        />
      </div>

      {showContextMenu ? (
        <FileManagerContextMenu
          contextShareActive={Boolean(contextShare)}
          entry={showContextMenu.entry}
          isTrashView={isTrashView}
          pasteDisabled={!clipboardState || isTrashView || pasteFileEntryMutation.isPending}
          x={showContextMenu.x}
          y={showContextMenu.y}
          onClose={() => dispatch({ type: "HIDE_CONTEXT_MENU" })}
          onCopy={() => setClipboardFromEntries([showContextMenu.entry], "copy")}
          onCopyPath={() => void handleCopyEntryPath(showContextMenu.entry)}
          onCut={() => setClipboardFromEntries([showContextMenu.entry], "move")}
          onDeletePermanently={() => { void handleDeleteFromTrash(showContextMenu.entry); }}
          onDownload={() => handleDownloadEntry(showContextMenu.entry)}
          onGetInfo={() => { void handleGetInfo(showContextMenu.entry); }}
          onMoveToTrash={() => { void handleMoveSelectedToTrash(showContextMenu.entry); }}
          onOpen={() => navigateTo(showContextMenu.entry)}
          onPaste={() => {
            const destinationPath =
              showContextMenu.entry.type === "folder"
                ? showContextMenu.entry.path
                : toFilePath(currentPath);
            void handlePasteToDestination(destinationPath);
          }}
          onRename={() => { void handleRenameEntry(showContextMenu.entry); }}
          onRestore={() => { void handleRestoreFromTrash(showContextMenu.entry); }}
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
          onToggleStar={() => { void handleToggleStar(showContextMenu.entry); }}
        />
      ) : null}

      {showBackgroundContextMenu ? (
        <FileManagerBackgroundContextMenu
          pasteDisabled={!clipboardState || pasteFileEntryMutation.isPending}
          x={showBackgroundContextMenu.x}
          y={showBackgroundContextMenu.y}
          onClose={() => dispatch({ type: "HIDE_BACKGROUND_CONTEXT_MENU" })}
          onNewFolder={() => dispatch({ type: "OPEN_CREATE_ENTRY_DIALOG", kind: "folder" })}
          onNewFile={() => dispatch({ type: "OPEN_CREATE_ENTRY_DIALOG", kind: "file" })}
          onPaste={() => { void handlePasteToDestination(toFilePath(currentPath)); }}
        />
      ) : null}

      {createEntryDialog ? (
        <CreateEntryDialog
          dialog={createEntryDialog}
          isCreatePending={createFolderMutation.isPending || createFileMutation.isPending}
          onClose={() => dispatch({ type: "CLOSE_CREATE_ENTRY_DIALOG" })}
          onDialogChange={(value) => {
            const error = value.includes("/") || value.includes("\0")
              ? 'Name cannot contain "/" or null characters'
              : null;
            dispatch({ type: "UPDATE_CREATE_ENTRY_DIALOG", name: value, error });
          }}
          onSubmit={() => { void submitCreateEntryDialog(); }}
        />
      ) : null}

      {renameDialog ? (
        <RenameEntryDialog
          dialog={renameDialog}
          isRenamePending={renameFileEntryMutation.isPending}
          onClose={() => dispatch({ type: "CLOSE_RENAME_DIALOG" })}
          onDialogChange={(value) => {
            const error = value.includes("/") || value.includes("\0")
              ? 'Name cannot contain "/" or null characters'
              : null;
            dispatch({ type: "UPDATE_RENAME_DIALOG", name: value, error });
          }}
          onSubmit={() => { void submitRenameDialog(); }}
        />
      ) : null}

      {showEmptyTrashConfirm ? (
        <EmptyTrashConfirmDialog
          itemCount={trashItemCount}
          onCancel={() => dispatch({ type: "HIDE_EMPTY_TRASH_CONFIRM" })}
          onConfirm={() => { void confirmEmptyTrash(); }}
        />
      ) : null}

      {fileInfoDialog ? (
        <FileInfoDialogOverlay
          fileInfo={fileInfoDialog}
          onClose={() => dispatch({ type: "CLOSE_FILE_INFO_DIALOG" })}
        />
      ) : null}

      {pasteConflict ? (
        <PasteConflictDialog
          conflictName={pasteConflict.conflictName}
          onReplace={() => { void handleConflictResolution("replace"); }}
          onKeepBoth={() => { void handleConflictResolution("keep-both"); }}
          onSkip={() => { void handleConflictResolution("skip"); }}
          onSkipAll={() => { void handleConflictResolution("skip-all"); }}
        />
      ) : null}

      <NetworkStorageDialog
        isOpen={showNetworkDialog}
        onClose={() => dispatch({ type: "HIDE_NETWORK_DIALOG" })}
        onNavigateToNetwork={() => {
          dispatch({ type: "NAVIGATE_TO_PATH", path: ["Network"] });
          dispatch({ type: "HIDE_NETWORK_DIALOG" });
        }}
      />
    </div>
  );
}
