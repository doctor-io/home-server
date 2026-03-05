"use client";

import { NetworkStorageDialog } from "@/components/desktop/network-storage-dialog";
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
} from "@/hooks/useFiles";
import {
  useCreateLocalFolderShare,
  useDeleteLocalFolderShare,
  useLocalFolderShares,
} from "@/hooks/useLocalFolderShares";
import { useNetworkShares } from "@/hooks/useNetworkShares";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import {
  useDeleteFromTrash,
  useEmptyTrash,
  useMoveToTrash,
  useRestoreFromTrash,
} from "@/hooks/useTrashActions";
import { formatBytesCompact } from "@/lib/client/format";
import type { FileInfoResponse, FileListEntry } from "@/lib/shared/contracts/files";
import {
  ArrowUp,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  EyeOff,
  File,
  FileArchive,
  FileCode,
  FileCog,
  FileImage,
  FileText,
  FileVideo,
  Folder,
  FolderOpen,
  Globe,
  HardDrive,
  Home,
  Info,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Plus,
  Save,
  Scissors,
  Search,
  SortAsc,
  SortDesc,
  Star,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// --- Types ---

type FileEntry = {
  name: string;
  path: string;
  type: "folder" | "file";
  ext?: string;
  size?: string;
  sizeBytes?: number | null;
  modified: string;
  modifiedAt: string;
  mtimeMs: number;
  starred?: boolean;
  trashOriginalPath?: string;
  trashDeletedAt?: string;
};

// --- Helpers ---

const PATH_ALIAS_MAP: Record<string, string> = {
  Downloads: "Download",
};

function normalizePathForBackend(pathSegments: string[]) {
  return pathSegments.map((segment) => PATH_ALIAS_MAP[segment] ?? segment);
}

const DISPLAY_PATH_ALIAS_MAP: Record<string, string> = {
  Download: "Downloads",
};

function normalizePathForDisplay(pathSegments: string[]) {
  return pathSegments.map(
    (segment) => DISPLAY_PATH_ALIAS_MAP[segment] ?? segment,
  );
}

function toUiFileEntry(entry: FileListEntry): FileEntry {
  const modifiedDate = new Date(entry.modifiedAt);

  return {
    name: entry.name,
    path: entry.path,
    type: entry.type,
    ext: entry.ext ?? undefined,
    size:
      entry.sizeBytes === null
        ? undefined
        : formatBytesCompact(entry.sizeBytes),
    sizeBytes: entry.sizeBytes,
    modified: Number.isNaN(modifiedDate.getTime())
      ? "--"
      : modifiedDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
    modifiedAt: entry.modifiedAt,
    mtimeMs: entry.mtimeMs,
    starred: entry.starred ?? false,
    trashOriginalPath: entry.trashOriginalPath,
    trashDeletedAt: entry.trashDeletedAt,
  };
}

function getFileIcon(entry: FileEntry) {
  if (entry.type === "folder") {
    return <Folder className="size-4 text-sky-400" />;
  }
  const ext = entry.ext?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext ?? ""))
    return <FileImage className="size-4 text-pink-400" />;
  if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext ?? ""))
    return <FileVideo className="size-4 text-amber-400" />;
  if (["gz", "tar", "zip", "rar", "7z", "deb", "iso"].includes(ext ?? ""))
    return <FileArchive className="size-4 text-orange-400" />;
  if (
    [
      "js",
      "ts",
      "py",
      "sh",
      "json",
      "yml",
      "yaml",
      "conf",
      "env",
      "md",
      "css",
      "html",
    ].includes(ext ?? "")
  )
    return <FileCode className="size-4 text-emerald-400" />;
  if (["log", "csv"].includes(ext ?? ""))
    return <FileCog className="size-4 text-muted-foreground" />;
  if (["txt", "doc", "pdf"].includes(ext ?? ""))
    return <FileText className="size-4 text-blue-300" />;
  return <File className="size-4 text-muted-foreground" />;
}

function getLargeFileIcon(entry: FileEntry) {
  if (entry.type === "folder") {
    return <Folder className="size-10 text-sky-400" />;
  }
  const ext = entry.ext?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext ?? ""))
    return <FileImage className="size-10 text-pink-400" />;
  if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext ?? ""))
    return <FileVideo className="size-10 text-amber-400" />;
  if (["gz", "tar", "zip", "rar", "7z", "deb", "iso"].includes(ext ?? ""))
    return <FileArchive className="size-10 text-orange-400" />;
  if (
    [
      "js",
      "ts",
      "py",
      "sh",
      "json",
      "yml",
      "yaml",
      "conf",
      "env",
      "md",
      "css",
      "html",
    ].includes(ext ?? "")
  )
    return <FileCode className="size-10 text-emerald-400" />;
  if (["log", "csv"].includes(ext ?? ""))
    return <FileCog className="size-10 text-muted-foreground" />;
  if (["txt", "doc", "pdf"].includes(ext ?? ""))
    return <FileText className="size-10 text-blue-300" />;
  return <File className="size-10 text-muted-foreground" />;
}

function getEditorLanguage(entry: FileEntry): string {
  const ext = entry.ext?.toLowerCase();
  if (!ext) return "plaintext";

  if (["js", "mjs", "cjs"].includes(ext)) return "javascript";
  if (["ts", "tsx"].includes(ext)) return "typescript";
  if (["json"].includes(ext)) return "json";
  if (["md"].includes(ext)) return "markdown";
  if (["html", "htm"].includes(ext)) return "html";
  if (["css"].includes(ext)) return "css";
  if (["py"].includes(ext)) return "python";
  if (["sh", "bash", "zsh"].includes(ext)) return "shell";
  if (["yml", "yaml"].includes(ext)) return "yaml";
  if (["xml"].includes(ext)) return "xml";
  if (["sql"].includes(ext)) return "sql";
  if (["ini", "conf", "env"].includes(ext)) return "ini";
  return "plaintext";
}

function getMonacoTheme() {
  if (typeof document === "undefined") return "vs-dark";

  const theme = document.documentElement.dataset.desktopTheme;
  if (theme === "light") return "vs";
  if (theme === "dark") return "vs-dark";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "vs-dark"
    : "vs";
}

const MONACO_CDN_BASE =
  "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min";
const BYTES_PER_TB = 1024 ** 4;

function formatTerabytesRounded1(bytes: number) {
  const value = bytes / BYTES_PER_TB;
  const rounded = value.toFixed(1);
  return rounded.endsWith(".0") ? rounded.slice(0, -2) : rounded;
}

function clampPercent(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, 100));
}

type MonacoSubscription = { dispose: () => void };
type MonacoModel = { dispose: () => void };
type MonacoEditorInstance = {
  onDidChangeModelContent: (listener: () => void) => MonacoSubscription;
  getValue: () => string;
  layout: () => void;
  getModel: () => MonacoModel | null;
  dispose: () => void;
  __changeSub?: MonacoSubscription;
};
type MonacoNamespace = {
  editor: {
    createModel: (value: string, language: string) => MonacoModel;
    create: (
      container: HTMLElement,
      options: Record<string, unknown>,
    ) => MonacoEditorInstance;
    setTheme: (theme: string) => void;
  };
};
type MonacoRequire = {
  config: (config: { paths: { vs: string } }) => void;
  (deps: string[], onLoad: () => void, onError: (error: unknown) => void): void;
};

let monacoLoaderPromise: Promise<MonacoNamespace> | null = null;

function loadMonacoFromCdn(): Promise<MonacoNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Monaco can only load in the browser"));
  }

  const win = window as typeof window & {
    monaco?: MonacoNamespace;
    require?: MonacoRequire;
  };
  if (win.monaco?.editor) return Promise.resolve(win.monaco);
  if (monacoLoaderPromise) return monacoLoaderPromise;

  monacoLoaderPromise = new Promise((resolve, reject) => {
    const boot = () => {
      if (!win.require) {
        reject(new Error("Monaco loader is unavailable"));
        return;
      }
      win.require.config({ paths: { vs: `${MONACO_CDN_BASE}/vs` } });
      win.require(["vs/editor/editor.main"], () => resolve(win.monaco), reject);
    };

    if (win.require) {
      boot();
      return;
    }

    const existing = document.getElementById(
      "monaco-loader-script",
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", boot, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Monaco loader script")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "monaco-loader-script";
    script.src = `${MONACO_CDN_BASE}/vs/loader.min.js`;
    script.async = true;
    script.onload = boot;
    script.onerror = () =>
      reject(new Error("Failed to load Monaco loader script"));
    document.body.appendChild(script);
  });

  return monacoLoaderPromise;
}

// --- Sidebar Quick Access ---

type SidebarSection = {
  title: string;
  items: {
    name: string;
    icon: React.ReactNode;
    path: string[];
  }[];
};

const STARRED_VIRTUAL_PATH = ["⭐Starred"] as const;

const sidebarSections: SidebarSection[] = [
  {
    title: "Favorites",
    items: [
      {
        name: "Home",
        icon: <Home className="size-4 text-muted-foreground" />,
        path: [],
      },
      {
        name: "Starred",
        icon: <Star className="size-4 text-amber-400 fill-amber-400" />,
        path: [...STARRED_VIRTUAL_PATH],
      },
      {
        name: "Documents",
        icon: <FileText className="size-4 text-sky-400" />,
        path: ["Documents"],
      },
      {
        name: "Downloads",
        icon: <Download className="size-4 text-emerald-400" />,
        path: ["Downloads"],
      },
      {
        name: "Media",
        icon: <FileVideo className="size-4 text-amber-400" />,
        path: ["Media"],
      },
      {
        name: "Apps",
        icon: <FileCog className="size-4 text-violet-400" />,
        path: ["Apps"],
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
  const statusNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function setStatusNotice(msg: string | null) {
    if (statusNoticeTimerRef.current) clearTimeout(statusNoticeTimerRef.current);
    setStatusNoticeRaw(msg);
    if (msg !== null) {
      statusNoticeTimerRef.current = setTimeout(() => setStatusNoticeRaw(null), 4000);
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
  const [renameDialog, setRenameDialog] =
    useState<RenameDialogState | null>(null);
  const [fileInfoDialog, setFileInfoDialog] =
    useState<FileInfoResponse | null>(null);
  const [pendingEntryPath, setPendingEntryPath] = useState<string | null>(null);
  const [showEmptyTrashConfirm, setShowEmptyTrashConfirm] = useState(false);

  const isStarredView = currentPath.length === 1 && currentPath[0] === STARRED_VIRTUAL_PATH[0];

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

  const isGlobalSearchActive =
    globalSearch && searchQuery.trim().length >= 2;

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
          dir * (new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime())
        );
      }
      if (sortBy === "size") return dir * ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0));
      return 0;
    };

    return [...folders.sort(sortFn), ...files.sort(sortFn)];
  }, [currentEntries, searchQuery, sortBy, sortDir]);

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
      ? `${formatTerabytesRounded1(storageMetrics.usedBytes)} TB / ${formatTerabytesRounded1(storageMetrics.totalBytes)} TB`
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
        icon: <HardDrive className="size-4 text-cyan-400" />,
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
        navigateTo(entry);
        return;
      }

      if (e.key === "Backspace" || e.key === "ArrowLeft") {
        if (currentPath.length > 0 && !isStarredView) {
          e.preventDefault();
          navigateUp();
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
          if (isTrashView) {
            void handleDeleteFromTrash(entry);
          } else {
            void handleMoveSelectedToTrash(entry);
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
      const anchorIdx = sortedEntries.findIndex((en) => en.name === selectedFile);
      const clickedIdx = sortedEntries.findIndex((en) => en.name === entry.name);
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
    const totalCount = directoryQuery.data?.entries.length ?? currentEntries.length;
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
      setStatusNotice(
        `Renamed to ${result.path.split("/").pop() ?? newName}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to rename item";
      setRenameDialog((prev) =>
        prev ? { ...prev, error: message } : prev,
      );
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
        setStatusNotice(`Uploaded ${uploaded} file${uploaded !== 1 ? "s" : ""}`);
      } else if (uploaded > 0) {
        setStatusNotice(`Uploaded ${uploaded}, skipped ${skipped} (already exist)`);
      } else {
        setStatusNotice(`Skipped ${skipped} file${skipped !== 1 ? "s" : ""} (already exist)`);
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

  // Count items
  const folderCount = sortedEntries.filter((e) => e.type === "folder").length;
  const fileCount = sortedEntries.filter((e) => e.type === "file").length;
  const contextShare =
    showContextMenu?.entry.type === "folder"
      ? localSharesByPath.get(showContextMenu.entry.path)
      : undefined;

  return (
    <div
      ref={rootRef}
      className="relative flex h-full"
      onClick={() => setShowContextMenu(null)}
    >
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <aside className="w-48 shrink-0 border-r border-glass-border bg-glass flex flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-3 pt-4">
            {sidebarSections.map((section) => (
              <div key={section.title}>
                <div className="flex items-center justify-between px-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {section.title}
                  </span>
                  {section.title === "Locations" ? (
                    <button
                      onClick={() => setShowNetworkDialog(true)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                      title="Add network storage"
                      aria-label="Add network storage"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col gap-0.5 mt-1.5">
                  {(section.title === "Locations"
                    ? locationItems
                    : section.items
                  ).map((item) => {
                    const isActive =
                      JSON.stringify(normalizePathForBackend(item.path)) ===
                      JSON.stringify(currentPath);
                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          navigateToPath(item.path);
                        }}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        }`}
                      >
                        {item.icon}
                        <span className="truncate">{item.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom shortcuts + storage */}
          <div className="mt-auto p-3 border-t border-glass-border">
            <div className="mb-3 flex flex-col gap-0.5">
              <button
                onClick={() => navigateToPath(["Shared"])}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isSharedView
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <Users className="size-3.5 text-sky-400" />
                <span>Shared</span>
              </button>
              <button
                onClick={() => navigateToPath(["Trash"])}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isTrashView
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <Trash2 className="size-3.5 text-status-red" />
                <span>Trash</span>
              </button>
            </div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Storage</span>
              <span className="text-xs text-muted-foreground">
                {storageUsageText}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${storageUsagePercent}%` }}
              />
            </div>
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto px-3 py-2 border-b border-glass-border bg-card/65">
          {/* Navigation */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={navigateUp}
              disabled={currentPath.length === 0}
              className="p-1.5 rounded-lg hover:bg-secondary/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              aria-label="Go up one level"
            >
              <ArrowUp className="size-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Breadcrumb */}
          <nav
            className="flex min-w-0 flex-1 items-center gap-1"
            aria-label="File path"
          >
            <button
              onClick={() => navigateToPath([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary/40 cursor-pointer shrink-0"
            >
              <span className="inline-flex items-center gap-1">
                <HardDrive className="size-3.5" />
                <span className="hidden 2xl:inline">{rootLabel}</span>
              </span>
            </button>
            {currentPath.map((segment, i) => (
              <div key={i} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
                <button
                  onClick={() => navigateToPath(currentPath.slice(0, i + 1))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary/40 truncate max-w-24 sm:max-w-28 md:max-w-32 cursor-pointer"
                >
                  {currentPathForDisplay[i] ?? segment}
                </button>
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-1 shrink-0">
            {!isTrashView && !isStarredView && (
              <>
                <button
                  onClick={() => {
                    openCreateEntryDialog("folder");
                  }}
                  disabled={createFolderMutation.isPending}
                  className="relative inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="New folder"
                  title="New folder"
                >
                  <Folder className="size-3.5" />
                  <Plus className="absolute -right-0.5 -top-0.5 size-2.5" />
                </button>
                <button
                  onClick={() => {
                    openCreateEntryDialog("file");
                  }}
                  disabled={createFileMutation.isPending}
                  className="relative inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="New file"
                  title="New file"
                >
                  <File className="size-3.5" />
                  <Plus className="absolute -right-0.5 -top-0.5 size-2.5" />
                </button>
                <button
                  onClick={() => uploadInputRef.current?.click()}
                  disabled={uploadFilesMutation.isPending}
                  className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Upload files"
                  title="Upload files"
                >
                  <Upload className="size-3.5" />
                </button>
                <input
                  ref={uploadInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    void handleUploadFiles(files);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <div className="relative w-36">
              {globalSearchQuery.isFetching ? (
                <Loader2 className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-primary animate-spin" />
              ) : (
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              )}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={globalSearch ? "Search everywhere..." : "Search..."}
                className={`h-7 w-full pl-7 pr-2 rounded-lg bg-secondary/40 border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-secondary/60 transition-all ${
                  globalSearch
                    ? "border-primary/40 focus:border-primary/60"
                    : "border-glass-border focus:border-primary/40"
                }`}
              />
            </div>
            <button
              onClick={() => setGlobalSearch((v) => !v)}
              className={`inline-flex size-7 items-center justify-center rounded-lg text-xs transition-colors cursor-pointer ${
                globalSearch
                  ? "bg-primary/20 text-primary hover:bg-primary/30"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              }`}
              title={globalSearch ? "Switch to local search" : "Search everywhere (recursive)"}
            >
              <Globe className="size-3.5" />
            </button>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 shrink-0">
            {isTrashView ? (
              <button
                onClick={() => {
                  void handleEmptyTrash();
                }}
                disabled={
                  isEmptyingTrash ||
                  emptyTrashMutation.isPending ||
                  currentEntries.length === 0
                }
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-status-red/10 text-xs text-status-red transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                title="Permanently delete all items in Trash"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden xl:inline">Empty Trash</span>
              </button>
            ) : null}
            <button
              onClick={() => setIncludeHidden((value) => !value)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer"
              title={includeHidden ? "Hide hidden files" : "Show hidden files"}
            >
              {includeHidden ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
            <button
              onClick={() => {
                setSortBy((s) => {
                  const next = s === "name" ? "modified" : s === "modified" ? "size" : "name";
                  setSortDir("asc"); // reset direction when switching field
                  return next;
                });
              }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer"
              title={`Sort by: ${sortBy} (click to change field)`}
            >
              <span className="capitalize hidden xl:inline">{sortBy}</span>
            </button>
            <button
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="flex items-center p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground transition-colors cursor-pointer"
              title={sortDir === "asc" ? "Ascending — click to reverse" : "Descending — click to reverse"}
            >
              {sortDir === "asc" ? <SortAsc className="size-3" /> : <SortDesc className="size-3" />}
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-secondary/30 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="List view"
            >
              <List className="size-3.5" />
            </button>
          </div>
        </div>

        {/* File area */}
        <div
          className="flex-1 overflow-y-auto p-3 relative"
          onDragOver={(e) => {
            if (isTrashView || isStarredView) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setIsDragOver(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDragOver(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (isTrashView || isStarredView) return;
            const files = Array.from(e.dataTransfer.files);
            void handleUploadFiles(files);
          }}
        >
          {isDragOver && !isTrashView && !isStarredView && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 pointer-events-none">
              <Upload className="size-8 text-primary/70 mb-2" />
              <span className="text-sm text-primary/80 font-medium">Drop files to upload</span>
            </div>
          )}
          {openFile ? (
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-glass-border bg-card/75">
              <div className="flex items-center gap-2 border-b border-glass-border bg-popover/70 px-3 py-2">
                <button
                  onClick={() => setOpenFile(null)}
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
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs uppercase tracking-wider text-primary">
                    {openFileBadgeLabel}
                  </span>
                </div>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    void handleSaveOpenFile();
                  }}
                  disabled={!canSaveOpenFile}
                  className="flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save className="size-3" /> Save
                </button>
                <button
                  onClick={() => setOpenFile(null)}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                  aria-label="Close editor"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              <div className="min-h-0 flex-1">
                {fileContentQuery.isLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading file...
                  </div>
                ) : fileContentQuery.isError ? (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-status-red">
                    {fileContentQuery.error instanceof Error
                      ? fileContentQuery.error.message
                      : "Failed to open file"}
                  </div>
                ) : openFileViewer?.mode === "text" ? (
                  <MonacoEditorPane
                    key={openFileKey ?? "editor"}
                    language={openFileLanguage}
                    value={openFileContent}
                    onChange={(value) => {
                      if (!openFileKey) return;
                      setFileDrafts((prev) => ({
                        ...prev,
                        [openFileKey]: value,
                      }));
                    }}
                  />
                ) : openFileViewer?.mode === "image" ? (
                  <div className="flex h-full items-center justify-center overflow-auto bg-card/90 p-4">
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
                    className="h-full w-full border-0 bg-card/90"
                  />
                ) : openFileViewer?.mode === "video" ? (
                  <div className="flex h-full items-center justify-center overflow-auto bg-black/95 p-4">
                    { }
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
              {editorNotice && (
                <div className="border-t border-glass-border px-3 py-2 text-xs text-muted-foreground">
                  {editorNotice}
                </div>
              )}
            </div>
          ) : directoryQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <FolderOpen className="size-12 opacity-30" />
              <span className="text-sm">Loading files...</span>
            </div>
          ) : directoryQuery.isError ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-status-red">
              <FolderOpen className="size-12 opacity-50" />
              <span className="text-sm text-center">
                {directoryQuery.error instanceof Error
                  ? directoryQuery.error.message
                  : "Failed to load files"}
              </span>
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              {isGlobalSearchActive && globalSearchQuery.isFetching ? (
                <Loader2 className="size-10 animate-spin opacity-40" />
              ) : (
                <FolderOpen className="size-12 opacity-30" />
              )}
              <span className="text-sm">
                {isGlobalSearchActive
                  ? globalSearchQuery.isFetching
                    ? "Searching..."
                    : "No results found"
                  : searchQuery
                    ? "No matching files found"
                    : "This folder is empty"}
              </span>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {sortedEntries.map((entry) => (
                <button
                  key={entry.name}
                  title={isGlobalSearchActive ? entry.path : entry.name}
                  onClick={(e) => handleEntryClick(e, entry)}
                  onDoubleClick={() => navigateTo(entry)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all cursor-pointer ${
                    selectedFiles.has(entry.name)
                      ? "bg-primary/15 border border-primary/30"
                      : "border border-transparent hover:bg-secondary/40"
                  }`}
                >
                  <div className="relative">
                    {pendingEntryPath === entry.path ? (
                      <div className="size-10 flex items-center justify-center">
                        <Loader2 className="size-6 text-primary animate-spin" />
                      </div>
                    ) : getLargeFileIcon(entry)}
                    {entry.starred && pendingEntryPath !== entry.path && (
                      <Star className="absolute -top-1 -right-1 size-3 text-amber-400 fill-amber-400" />
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    <span className="text-xs font-medium text-foreground text-center leading-tight line-clamp-2 break-all">
                      {entry.name}
                    </span>
                    {entry.size && (
                      <span className="text-xs text-muted-foreground">
                        {entry.size}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {/* List header */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-glass-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex-1 min-w-0">Name</span>
                {isTrashView && (
                  <span className="w-48 text-right hidden lg:block">Original Location</span>
                )}
                {isGlobalSearchActive && (
                  <span className="w-48 text-right hidden lg:block">Location</span>
                )}
                <span className="w-20 text-right hidden sm:block">Size</span>
                <span className="w-32 text-right hidden md:block">
                  {isTrashView ? "Deleted" : "Modified"}
                </span>
              </div>
              {sortedEntries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={(e) => handleEntryClick(e, entry)}
                  onDoubleClick={() => navigateTo(entry)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                  className={`flex items-center gap-3 px-3 py-2 transition-colors cursor-pointer text-left ${
                    selectedFiles.has(entry.name)
                      ? "bg-primary/15"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {pendingEntryPath === entry.path ? (
                      <Loader2 className="size-4 text-primary animate-spin shrink-0" />
                    ) : getFileIcon(entry)}
                    <span className="text-xs text-foreground truncate">
                      {entry.name}
                    </span>
                    {entry.starred && pendingEntryPath !== entry.path && (
                      <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </div>
                  {isTrashView && (
                    <span className="w-48 text-right text-xs text-muted-foreground shrink-0 truncate hidden lg:block" title={entry.trashOriginalPath}>
                      {entry.trashOriginalPath ?? "—"}
                    </span>
                  )}
                  {isGlobalSearchActive && (
                    <span className="w-48 text-right text-xs text-muted-foreground shrink-0 truncate hidden lg:block" title={entry.path}>
                      {entry.path.includes("/")
                        ? entry.path.slice(0, entry.path.lastIndexOf("/"))
                        : "/"}
                    </span>
                  )}
                  <span className="w-20 text-right text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {entry.type === "folder" ? "—" : (entry.size ?? "0 B")}
                  </span>
                  <span className="w-32 text-right text-xs text-muted-foreground shrink-0 hidden md:block">
                    {isTrashView
                      ? entry.trashDeletedAt
                        ? new Date(entry.trashDeletedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "—"
                      : entry.modified}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-glass-border bg-card/60 text-xs text-muted-foreground">
          <span className="flex items-center gap-3">
            <span>
              {folderCount > 0 &&
                `${folderCount} folder${folderCount > 1 ? "s" : ""}`}
              {folderCount > 0 && fileCount > 0 && ", "}
              {fileCount > 0 && `${fileCount} file${fileCount > 1 ? "s" : ""}`}
            </span>
            {selectedFiles.size > 1 && (
              <span className="flex items-center gap-1.5 text-primary">
                <span>{selectedFiles.size} selected</span>
                {!isTrashView && !isStarredView && (
                  <button
                    onClick={() => void handleTrashSelected()}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-status-red/10 text-status-red hover:bg-status-red/20 transition-colors cursor-pointer"
                    title="Move selected to Trash"
                  >
                    <Trash2 className="size-3" />
                    <span>Trash selected</span>
                  </button>
                )}
              </span>
            )}
          </span>
          <div className="flex items-center gap-3">
            {statusNotice ? (
              <span className="max-w-72 truncate text-status-amber">
                {statusNotice}
              </span>
            ) : null}
            {clipboardState ? (
              <span className="max-w-56 truncate text-muted-foreground">
                {clipboardState.operation === "copy" ? "Clipboard" : "Cut"}:{" "}
                {clipboardState.name}
              </span>
            ) : null}
            <span className="font-mono">
              {rootLabel}
              {currentPathForDisplay.length > 0
                ? `/${currentPathForDisplay.join("/")}`
                : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="absolute z-[200] min-w-44 py-1.5 rounded-xl bg-popover border border-glass-border backdrop-blur-2xl shadow-2xl shadow-black/50"
          style={{ left: showContextMenu.x, top: showContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem
            icon={<FolderOpen className="size-3.5" />}
            label="Open"
            onClick={() => {
              navigateTo(showContextMenu.entry);
              setShowContextMenu(null);
            }}
          />
          <ContextMenuItem
            icon={<Info className="size-3.5" />}
            label="Get Info"
            onClick={() => {
              const entry = showContextMenu.entry;
              setShowContextMenu(null);
              void handleGetInfo(entry);
            }}
          />
          <ContextMenuItem
            icon={<Link2 className="size-3.5" />}
            label="Copy Path"
            onClick={async () => {
              const entry = showContextMenu.entry;
              setShowContextMenu(null);
              const hostname = systemMetricsQuery.data?.hostname ?? "";
              const share = localSharesByPath.get(entry.path);
              let fullPath: string;
              if (share && hostname) {
                fullPath = `\\\\${hostname}\\${share.shareName}`;
              } else {
                fullPath = filesRootPath
                  ? `${filesRootPath}/${entry.path}`
                  : `/${entry.path}`;
              }
              try {
                if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(fullPath);
                } else {
                  // Fallback for non-secure contexts (HTTP)
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
            }}
          />
          {!isTrashView ? (
            <ContextMenuItem
              icon={<FileText className="size-3.5" />}
              label="Rename"
              onClick={() => {
                const entry = showContextMenu.entry;
                setShowContextMenu(null);
                void handleRenameEntry(entry);
              }}
            />
          ) : null}
          <div className="h-px bg-border mx-2 my-1" />
          <ContextMenuItem
            icon={<Copy className="size-3.5" />}
            label="Copy"
            onClick={() => {
              const entry = showContextMenu.entry;
              setShowContextMenu(null);
              setClipboardFromEntry(entry, "copy");
            }}
          />
          <ContextMenuItem
            icon={<Scissors className="size-3.5" />}
            label="Cut"
            onClick={() => {
              const entry = showContextMenu.entry;
              setShowContextMenu(null);
              setClipboardFromEntry(entry, "move");
            }}
          />
          <ContextMenuItem
            icon={<ClipboardPaste className="size-3.5" />}
            label="Paste"
            disabled={
              !clipboardState || isTrashView || pasteFileEntryMutation.isPending
            }
            onClick={() => {
              const entry = showContextMenu.entry;
              setShowContextMenu(null);
              const destinationPath =
                entry.type === "folder" ? entry.path : toFilePath(currentPath);
              void handlePasteToDestination(destinationPath);
            }}
          />
          <div className="h-px bg-border mx-2 my-1" />
          <ContextMenuItem
            icon={<Star className="size-3.5 text-amber-400" />}
            label="Toggle Star"
            onClick={() => {
              const entry = showContextMenu.entry;
              setShowContextMenu(null);
              void handleToggleStar(entry);
            }}
          />
          <ContextMenuItem
            icon={<Download className="size-3.5" />}
            label={showContextMenu.entry.type === "folder" ? "Download as Zip" : "Download"}
            onClick={() => {
              const entry = showContextMenu.entry;
              setShowContextMenu(null);
              handleDownloadEntry(entry);
            }}
          />
          {showContextMenu.entry.type === "folder" && !isTrashView ? (
            <>
              <ContextMenuItem
                icon={<Users className="size-3.5 text-sky-400" />}
                label={contextShare ? "Stop Sharing" : "Share Folder"}
                onClick={() => {
                  const entry = showContextMenu.entry;
                  const activeShare = contextShare;
                  setShowContextMenu(null);
                  if (activeShare) {
                    void handleUnshareFolder(activeShare.id);
                    return;
                  }
                  if (
                    entry.path === "Shared" ||
                    entry.path.startsWith("Shared/") ||
                    entry.path === "Network" ||
                    entry.path.startsWith("Network/")
                  ) {
                    setStatusNotice("Cannot share this folder path");
                    return;
                  }
                  void handleShareFolder(entry);
                }}
              />
              <div className="h-px bg-border mx-2 my-1" />
            </>
          ) : null}
          {isTrashView ? (
            <>
              <ContextMenuItem
                icon={<ArrowUp className="size-3.5" />}
                label="Restore"
                onClick={() => {
                  const entry = showContextMenu.entry;
                  setShowContextMenu(null);
                  void handleRestoreFromTrash(entry);
                }}
              />
              <ContextMenuItem
                icon={<Trash2 className="size-3.5 text-status-red" />}
                label="Delete Permanently"
                danger
                onClick={() => {
                  const entry = showContextMenu.entry;
                  setShowContextMenu(null);
                  void handleDeleteFromTrash(entry);
                }}
              />
            </>
          ) : (
            <ContextMenuItem
              icon={<Trash2 className="size-3.5 text-status-red" />}
              label="Move to Trash"
              danger
              onClick={() => {
                const entry = showContextMenu.entry;
                setShowContextMenu(null);
                void handleMoveSelectedToTrash(entry);
              }}
            />
          )}
        </div>
      )}
      {createEntryDialog ? (
        <div
          className="absolute inset-0 z-[205] flex items-center justify-center bg-background/35 px-4 backdrop-blur-[1px]"
          onClick={() => {
            closeCreateEntryDialog();
          }}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-glass-border bg-popover/95 p-3 shadow-2xl shadow-black/45"
            role="dialog"
            aria-modal="true"
            aria-label={
              createEntryDialog.kind === "folder"
                ? "Create new folder"
                : "Create new file"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              {createEntryDialog.kind === "folder" ? (
                <Folder className="size-4 text-sky-400" />
              ) : (
                <File className="size-4 text-emerald-400" />
              )}
              <span>
                {createEntryDialog.kind === "folder"
                  ? "Create New Folder"
                  : "Create New File"}
              </span>
            </div>
            <label className="mb-2 block text-xs text-muted-foreground">
              {createEntryDialog.kind === "folder"
                ? "Folder name"
                : "File name"}
              <input
                autoFocus
                type="text"
                value={createEntryDialog.name}
                onChange={(event) =>
                  setCreateEntryDialog((previous) =>
                    previous
                      ? {
                          ...previous,
                          name: event.target.value,
                          error: null,
                        }
                      : previous,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitCreateEntryDialog();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    closeCreateEntryDialog();
                  }
                }}
                className="mt-1 h-8 w-full rounded-lg border border-glass-border bg-secondary/30 px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/40 focus:bg-secondary/50"
                placeholder={
                  createEntryDialog.kind === "folder"
                    ? "my-folder"
                    : "notes.txt"
                }
              />
            </label>
            {createEntryDialog.error ? (
              <div className="mb-2 text-xs text-status-red">
                {createEntryDialog.error}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  closeCreateEntryDialog();
                }}
                disabled={
                  createFolderMutation.isPending || createFileMutation.isPending
                }
                className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void submitCreateEntryDialog();
                }}
                disabled={
                  createEntryDialog.name.trim().length === 0 ||
                  createFolderMutation.isPending ||
                  createFileMutation.isPending
                }
                className="rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {renameDialog ? (
        <div
          className="absolute inset-0 z-[205] flex items-center justify-center bg-background/35 px-4 backdrop-blur-[1px]"
          onClick={() => {
            closeRenameDialog();
          }}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-glass-border bg-popover/95 p-3 shadow-2xl shadow-black/45"
            role="dialog"
            aria-modal="true"
            aria-label="Rename item"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              {renameDialog.entry.type === "folder" ? (
                <Folder className="size-4 text-sky-400" />
              ) : (
                <File className="size-4 text-emerald-400" />
              )}
              <span>Rename</span>
            </div>
            <label className="mb-2 block text-xs text-muted-foreground">
              New name
              <input
                autoFocus
                type="text"
                value={renameDialog.name}
                onChange={(event) =>
                  setRenameDialog((prev) =>
                    prev
                      ? { ...prev, name: event.target.value, error: null }
                      : prev,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void submitRenameDialog();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    closeRenameDialog();
                  }
                }}
                className="mt-1 h-8 w-full rounded-lg border border-glass-border bg-secondary/30 px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/40 focus:bg-secondary/50"
                placeholder={renameDialog.entry.name}
              />
            </label>
            {renameDialog.error ? (
              <div className="mb-2 text-xs text-status-red">
                {renameDialog.error}
              </div>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  closeRenameDialog();
                }}
                disabled={renameFileEntryMutation.isPending}
                className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void submitRenameDialog();
                }}
                disabled={
                  renameDialog.name.trim().length === 0 ||
                  renameDialog.name.trim() === renameDialog.entry.name ||
                  renameFileEntryMutation.isPending
                }
                className="rounded-lg bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {renameFileEntryMutation.isPending ? "Renaming…" : "Rename"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showEmptyTrashConfirm ? (
        <div
          className="absolute inset-0 z-[205] flex items-center justify-center bg-background/35 px-4 backdrop-blur-[1px]"
          onClick={() => setShowEmptyTrashConfirm(false)}
        >
          <div
            className="w-full max-w-xs rounded-xl border border-glass-border bg-popover/95 p-4 shadow-2xl shadow-black/45"
            role="dialog"
            aria-modal="true"
            aria-label="Empty Trash"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Trash2 className="size-4 text-status-red shrink-0" />
              <span>Empty Trash</span>
            </div>
            <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
              Permanently delete{" "}
              <span className="font-semibold text-foreground">
                {directoryQuery.data?.entries.length ?? currentEntries.length}{" "}
                item{(directoryQuery.data?.entries.length ?? currentEntries.length) !== 1 ? "s" : ""}
              </span>{" "}
              from Trash? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowEmptyTrashConfirm(false)}
                className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmEmptyTrash()}
                className="rounded-lg bg-status-red/15 px-2.5 py-1 text-xs font-medium text-status-red transition-colors hover:bg-status-red/25"
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {fileInfoDialog ? (
        <div
          className="absolute inset-0 z-[205] flex items-center justify-center bg-background/35 px-4 backdrop-blur-[1px]"
          onClick={() => setFileInfoDialog(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-glass-border bg-popover/95 p-4 shadow-2xl shadow-black/45"
            role="dialog"
            aria-modal="true"
            aria-label="File info"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getFileIcon({ ...fileInfoDialog, modified: "", modifiedAt: "", mtimeMs: 0 } as FileEntry)}
                <span className="text-sm font-semibold text-foreground truncate max-w-56">{fileInfoDialog.name}</span>
              </div>
              <button
                onClick={() => setFileInfoDialog(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {/* Info rows */}
            <div className="space-y-1.5 text-xs">
              {[
                { label: "Type", value: fileInfoDialog.type === "folder" ? "Folder" : (fileInfoDialog.ext ? fileInfoDialog.ext.toUpperCase() + " file" : "File") },
                { label: "Size", value: fileInfoDialog.type === "folder" ? "—" : formatBytesCompact(fileInfoDialog.sizeBytes) },
                { label: "Modified", value: new Date(fileInfoDialog.modifiedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                { label: "Created", value: new Date(fileInfoDialog.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                { label: "Path", value: fileInfoDialog.path },
                { label: "Permissions", value: fileInfoDialog.permissions },
                { label: "Starred", value: fileInfoDialog.starred ? "Yes" : "No" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start gap-2 rounded-lg px-2.5 py-1.5 bg-secondary/20">
                  <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
                  <span className="text-foreground font-mono break-all">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => setFileInfoDialog(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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

function MonacoEditorPane({
  language,
  value,
  onChange,
}: {
  language: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let mounted = true;
    let editor: MonacoEditorInstance | undefined;
    let resizeObserver: ResizeObserver | null = null;
    let themeObserver: MutationObserver | null = null;

    loadMonacoFromCdn()
      .then((monaco) => {
        if (!mounted || !containerRef.current) return;
        const model = monaco.editor.createModel(value, language);
        editor = monaco.editor.create(containerRef.current, {
          model,
          theme: getMonacoTheme(),
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 13,
          lineHeight: 20,
          scrollBeyondLastLine: false,
          roundedSelection: false,
          padding: { top: 12, bottom: 12 },
        });

        const changeSub = editor.onDidChangeModelContent(() => {
          onChangeRef.current(editor.getValue());
        });

        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            editor.layout();
          });
          resizeObserver.observe(containerRef.current);
        }

        // Keep Monaco in sync with live appearance changes.
        themeObserver = new MutationObserver(() => {
          monaco.editor.setTheme(getMonacoTheme());
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["data-desktop-theme"],
        });

        editor.__changeSub = changeSub;
      })
      .catch(() => {
        if (mounted) setFallbackMode(true);
      });

    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      if (editor?.__changeSub) editor.__changeSub.dispose();
      if (editor?.getModel?.()) editor.getModel().dispose();
      if (editor?.dispose) editor.dispose();
    };
    // Monaco model is initialized once per language to avoid recreating editor per keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  if (fallbackMode) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-glass-border bg-status-amber/10 px-3 py-2 text-xs text-status-amber">
          Monaco failed to load. Showing fallback editor.
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full resize-none border-0 bg-card/90 p-4 font-mono text-sm leading-5 text-foreground outline-none"
          spellCheck={false}
        />
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full bg-card/90" />;
}

function ContextMenuItem({
  icon,
  label,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors cursor-pointer ${
        disabled
          ? "cursor-not-allowed text-muted-foreground/50"
          : danger
            ? "text-status-red hover:bg-status-red/10"
            : "text-foreground hover:bg-secondary/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
