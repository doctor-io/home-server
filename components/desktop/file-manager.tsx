"use client";

import { NetworkStorageDialog } from "@/components/desktop/network-storage-dialog";
import {
  buildAssetUrl,
  buildDownloadUrl,
  toFilePath,
  useCreateFile,
  useCreateFolder,
  useFileEntryInfo,
  useFileContent,
  useFilesDirectory,
  useFilesRoot,
  usePasteFileEntry,
  useRenameFileEntry,
  useSaveFileContent,
  useToggleFileStar,
} from "@/hooks/useFiles";
import {
  useCreateLocalFolderShare,
  useDeleteLocalFolderShare,
  useLocalFolderShares,
} from "@/hooks/useLocalFolderShares";
import { useNetworkShares } from "@/hooks/useNetworkShares";
import { useSystemMetrics } from "@/hooks/useSystemMetrics";
import {
  useEmptyTrash,
  useDeleteFromTrash,
  useMoveToTrash,
  useRestoreFromTrash,
} from "@/hooks/useTrashActions";
import { formatBytesCompact } from "@/lib/client/format";
import type { FileListEntry } from "@/lib/shared/contracts/files";
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
  HardDrive,
  Home,
  Info,
  LayoutGrid,
  List,
  Plus,
  Save,
  Scissors,
  Search,
  SortAsc,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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

export function FileManager() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [showContextMenu, setShowContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry;
  } | null>(null);
  const [sidebarCollapsed] = useState(false);
  const [openFile, setOpenFile] = useState<OpenFileState | null>(null);
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [editorNotice, setEditorNotice] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [clipboardState, setClipboardState] = useState<ClipboardState | null>(
    null,
  );
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);

  const filesRootQuery = useFilesRoot();
  const directoryQuery = useFilesDirectory(currentPath, includeHidden);
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
  const openFilePath = openFile ? toFilePath(openFile.path) : null;
  const fileContentQuery = useFileContent(openFilePath);

  const currentEntries = useMemo(
    () => (directoryQuery.data?.entries ?? []).map(toUiFileEntry),
    [directoryQuery.data?.entries],
  );

  const sortedEntries = useMemo(() => {
    let entries = [...currentEntries];

    if (searchQuery) {
      entries = entries.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Folders first, then files
    const folders = entries.filter((e) => e.type === "folder");
    const files = entries.filter((e) => e.type === "file");

    const sortFn = (a: FileEntry, b: FileEntry) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "modified") {
        return (
          new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
        );
      }
      if (sortBy === "size") return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
      return 0;
    };

    return [...folders.sort(sortFn), ...files.sort(sortFn)];
  }, [currentEntries, searchQuery, sortBy]);

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
  const localSharesByPath = useMemo(
    () => {
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
    },
    [localSharesQuery.data],
  );
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

  function openFileInEditor(path: string[], entry: FileEntry) {
    setOpenFile({ path, entry });
    setSelectedFile(entry.name);
  }

  function navigateTo(entry: FileEntry) {
    if (entry.type === "folder") {
      setCurrentPath(entry.path.split("/").filter(Boolean));
      setSelectedFile(null);
      setOpenFile(null);
      return;
    }

    openFileInEditor(entry.path.split("/").filter(Boolean), entry);
  }

  function navigateToPath(pathSegments: string[]) {
    setCurrentPath(normalizePathForBackend(pathSegments));
    setSelectedFile(null);
    setSearchQuery("");
    setOpenFile(null);
    setStatusNotice(null);
  }

  function navigateUp() {
    setCurrentPath((prev) => prev.slice(0, -1));
    setSelectedFile(null);
    setOpenFile(null);
  }

  function requestEntryName(kind: "file" | "folder") {
    if (typeof window === "undefined") {
      return null;
    }
    const entered = window.prompt(
      kind === "folder" ? "Folder name" : "File name",
      "",
    );
    if (entered === null) {
      return null;
    }
    const normalized = entered.trim();
    if (normalized.length === 0) {
      setStatusNotice(`Invalid ${kind} name`);
      return null;
    }
    return normalized;
  }

  async function handleCreateEntry(kind: "file" | "folder") {
    const name = requestEntryName(kind);
    if (!name) {
      return;
    }
    const parentPath = toFilePath(currentPath);

    try {
      const result =
        kind === "folder"
          ? await createFolderMutation.mutateAsync({
              parentPath,
              name,
            })
          : await createFileMutation.mutateAsync({
              parentPath,
              name,
            });
      setStatusNotice(
        `${kind === "folder" ? "Folder" : "File"} created: ${result.path}`,
      );
    } catch (error) {
      setStatusNotice(
        error instanceof Error
          ? error.message
          : `Failed to create ${kind}`,
      );
    }
  }

  function setClipboardFromEntry(entry: FileEntry, operation: "copy" | "move") {
    setClipboardState({
      sourcePath: entry.path,
      operation,
      name: entry.name,
    });
    setStatusNotice(`${operation === "copy" ? "Copied" : "Cut"}: ${entry.name}`);
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
        if (openFile && toFilePath(openFile.path) === clipboardState.sourcePath) {
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
    }
  }

  async function handleRestoreFromTrash(entry: FileEntry) {
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
    }
  }

  async function handleDeleteFromTrash(entry: FileEntry) {
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
    }
  }

  async function handleEmptyTrash() {
    if (!isTrashView || currentEntries.length === 0 || isEmptyingTrash) {
      return;
    }
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Permanently delete ${currentEntries.length} item${currentEntries.length > 1 ? "s" : ""} from Trash?`,
      );
      if (!confirmed) {
        return;
      }
    }

    setIsEmptyingTrash(true);
    try {
      const result = await emptyTrashMutation.mutateAsync();
      setStatusNotice(
        `Trash emptied (${result.deletedCount} item${result.deletedCount > 1 ? "s" : ""})`,
      );
    } catch (error) {
      setStatusNotice(
        error instanceof Error ? error.message : "Failed to empty Trash",
      );
    } finally {
      setIsEmptyingTrash(false);
    }
  }

  async function handleRenameEntry(entry: FileEntry) {
    if (isTrashView) {
      setStatusNotice("Rename is disabled in Trash");
      return;
    }
    const newName = window.prompt("Rename item", entry.name);
    if (!newName || newName.trim() === entry.name) {
      return;
    }

    try {
      const result = await renameFileEntryMutation.mutateAsync({
        path: entry.path,
        newName: newName.trim(),
      });
      setSelectedFile(null);
      setStatusNotice(`Renamed to ${result.path.split("/").pop() ?? newName.trim()}`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to rename item");
    }
  }

  async function handleGetInfo(entry: FileEntry) {
    try {
      const info = await getFileInfoMutation.mutateAsync(entry.path);
      setStatusNotice(
        `${info.name} | ${info.type} | ${formatBytesCompact(info.sizeBytes)} | perms ${info.permissions}`,
      );
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to get item info");
    }
  }

  async function handleToggleStar(entry: FileEntry) {
    try {
      const result = await toggleStarMutation.mutateAsync(entry.path);
      setStatusNotice(result.starred ? `Starred ${entry.name}` : `Unstarred ${entry.name}`);
    } catch (error) {
      setStatusNotice(error instanceof Error ? error.message : "Failed to toggle star");
    }
  }

  function handleDownloadEntry(entry: FileEntry) {
    if (entry.type !== "file") {
      setStatusNotice("Download is only available for files");
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
        error instanceof Error ? error.message : "Failed to remove shared folder",
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
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-glass-border bg-card/65">
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
            className="flex items-center gap-1 min-w-0 flex-1 basis-full md:basis-auto"
            aria-label="File path"
          >
            <button
              onClick={() => navigateToPath([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary/40 cursor-pointer shrink-0"
            >
              <span className="inline-flex items-center gap-1">
                <HardDrive className="size-3.5" />
                <span className="hidden xl:inline">{rootLabel}</span>
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
            <button
              onClick={() => {
                void handleCreateEntry("folder");
              }}
              disabled={createFolderMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              title="Create folder"
            >
              <Folder className="size-3.5" />
              <span className="hidden lg:inline">New Folder</span>
            </button>
            <button
              onClick={() => {
                void handleCreateEntry("file");
              }}
              disabled={createFileMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              title="Create file"
            >
              <File className="size-3.5" />
              <span className="hidden lg:inline">New File</span>
            </button>
          </div>

          <div className="relative min-w-[9rem] flex-1 sm:flex-none sm:w-36 md:w-44">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 w-full pl-7 pr-2 rounded-lg bg-secondary/40 border border-glass-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:bg-secondary/60 transition-all"
            />
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
                <span className="hidden lg:inline">Empty Trash</span>
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
              <span className="hidden lg:inline">
                {includeHidden ? "Hide Hidden" : "Show Hidden"}
              </span>
            </button>
            <button
              onClick={() =>
                setSortBy((s) =>
                  s === "name"
                    ? "modified"
                    : s === "modified"
                      ? "size"
                      : "name",
                )
              }
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer"
              title={`Sort by: ${sortBy}`}
            >
              <SortAsc className="size-3" />
              <span className="capitalize hidden lg:inline">{sortBy}</span>
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
        <div className="flex-1 overflow-y-auto p-3">
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
              <FolderOpen className="size-12 opacity-30" />
              <span className="text-sm">
                {searchQuery
                  ? "No matching files found"
                  : "This folder is empty"}
              </span>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
              {sortedEntries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => setSelectedFile(entry.name)}
                  onDoubleClick={() => navigateTo(entry)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all cursor-pointer ${
                    selectedFile === entry.name
                      ? "bg-primary/15 border border-primary/30"
                      : "border border-transparent hover:bg-secondary/40"
                  }`}
                >
                  <div className="relative">
                    {getLargeFileIcon(entry)}
                    {entry.starred && (
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
                <span className="w-20 text-right hidden sm:block">Size</span>
                <span className="w-32 text-right hidden md:block">
                  Modified
                </span>
              </div>
              {sortedEntries.map((entry) => (
                <button
                  key={entry.name}
                  onClick={() => setSelectedFile(entry.name)}
                  onDoubleClick={() => navigateTo(entry)}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                  className={`flex items-center gap-3 px-3 py-2 transition-colors cursor-pointer text-left ${
                    selectedFile === entry.name
                      ? "bg-primary/15"
                      : "hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {getFileIcon(entry)}
                    <span className="text-xs text-foreground truncate">
                      {entry.name}
                    </span>
                    {entry.starred && (
                      <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </div>
                  <span className="w-20 text-right text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {entry.type === "folder" ? "—" : (entry.size ?? "0 B")}
                  </span>
                  <span className="w-32 text-right text-xs text-muted-foreground shrink-0 hidden md:block">
                    {entry.modified}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-glass-border bg-card/60 text-xs text-muted-foreground">
          <span>
            {folderCount > 0 &&
              `${folderCount} folder${folderCount > 1 ? "s" : ""}`}
            {folderCount > 0 && fileCount > 0 && ", "}
            {fileCount > 0 && `${fileCount} file${fileCount > 1 ? "s" : ""}`}
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
            disabled={!clipboardState || isTrashView || pasteFileEntryMutation.isPending}
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
          {showContextMenu.entry.type === "file" ? (
            <ContextMenuItem
              icon={<Download className="size-3.5" />}
              label="Download"
              onClick={() => {
                const entry = showContextMenu.entry;
                setShowContextMenu(null);
                handleDownloadEntry(entry);
              }}
            />
          ) : null}
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
