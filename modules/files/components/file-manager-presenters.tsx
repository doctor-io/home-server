import { formatBytesCompact } from "@/lib/client/format";
import type { FileListEntry } from "@/lib/shared/contracts/files";
import {
  ArchiveFileIcon,
  AudioFileIcon,
  CodeFileIcon,
  DocumentFileIcon,
  FolderIcon,
  GenericFileIcon,
  ImageFileIcon,
  KoraFileIcon,
  TextFileIcon,
  VideoFileIcon,
} from "@/components/icons/file-icons";

export type FileEntry = {
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

const PATH_ALIAS_MAP: Record<string, string> = {
  Downloads: "Download",
};

const DISPLAY_PATH_ALIAS_MAP: Record<string, string> = {
  Download: "Downloads",
};

const EXTENSION_ICON_MAP: Record<string, string> = {
  "7z": "zip",
  bash: "shell",
  cjs: "javascript",
  css: "css",
  db: "database",
  gz: "archive",
  htm: "html",
  html: "html",
  iso: "archive",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  mjs: "javascript",
  md: "markdown",
  pdf: "pdf",
  py: "python",
  rar: "archive",
  sh: "shell",
  sql: "sql",
  sqlite: "database",
  tar: "archive",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zip: "zip",
  zsh: "shell",
};

export function normalizePathForBackend(pathSegments: string[]) {
  return pathSegments.map((segment) => PATH_ALIAS_MAP[segment] ?? segment);
}

export function normalizePathForDisplay(pathSegments: string[]) {
  return pathSegments.map(
    (segment) => DISPLAY_PATH_ALIAS_MAP[segment] ?? segment,
  );
}

export function toUiFileEntry(entry: FileListEntry): FileEntry {
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

function getFileIconForSize(entry: FileEntry, sizeClass: string) {
  if (entry.type === "folder") {
    return <FolderIcon className={sizeClass} name={entry.name} />;
  }
  const ext = (entry.ext ?? entry.name.split(".").pop() ?? "").toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return <ImageFileIcon className={sizeClass} />;
  }
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac", "opus"].includes(ext)) {
    return <AudioFileIcon className={sizeClass} />;
  }
  if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext)) {
    return <VideoFileIcon className={sizeClass} />;
  }
  const iconKey = EXTENSION_ICON_MAP[ext];
  if (iconKey) {
    return <KoraFileIcon className={sizeClass} iconKey={iconKey} />;
  }
  if (["txt", "log", "csv"].includes(ext)) {
    return <TextFileIcon className={sizeClass} />;
  }
  if (["doc", "docx"].includes(ext)) {
    return <DocumentFileIcon className={sizeClass} />;
  }
  if (["gz", "tar", "rar", "7z", "deb", "iso"].includes(ext)) {
    return <ArchiveFileIcon className={sizeClass} />;
  }
  if (["conf", "env"].includes(ext)) {
    return <CodeFileIcon className={sizeClass} />;
  }
  return <GenericFileIcon className={sizeClass} />;
}

export function getFileIcon(entry: FileEntry) {
  return getFileIconForSize(entry, "size-5");
}

export function getLargeFileIcon(entry: FileEntry) {
  return getFileIconForSize(entry, "size-14");
}

export function getEditorLanguage(entry: FileEntry): string {
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
