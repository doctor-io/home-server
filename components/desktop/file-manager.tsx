"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  FolderOpen,
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  FileCode,
  FileCog,
  File,
  ChevronRight,
  LayoutGrid,
  List,
  ArrowUp,
  Search,
  HardDrive,
  Home,
  Download,
  Star,
  Trash2,
  Clock,
  SortAsc,
  MoreHorizontal,
  FolderPlus,
  FilePlus,
  Copy,
  Scissors,
  ClipboardPaste,
  Info,
  Save,
  X,
} from "lucide-react"

// --- Types ---

type FileEntry = {
  name: string
  type: "folder" | "file"
  ext?: string
  size?: string
  modified: string
  starred?: boolean
  children?: FileEntry[]
}

// --- Mock File System ---

const fileSystem: FileEntry[] = [
  {
    name: "Documents",
    type: "folder",
    modified: "Feb 20, 2026",
    children: [
      {
        name: "Server Notes",
        type: "folder",
        modified: "Feb 18, 2026",
        children: [
          { name: "setup-guide.md", type: "file", ext: "md", size: "12 KB", modified: "Feb 18, 2026" },
          { name: "backup-plan.md", type: "file", ext: "md", size: "8 KB", modified: "Feb 15, 2026" },
          { name: "network-diagram.png", type: "file", ext: "png", size: "340 KB", modified: "Feb 12, 2026" },
        ],
      },
      { name: "docker-compose.yml", type: "file", ext: "yml", size: "4.2 KB", modified: "Feb 19, 2026", starred: true },
      { name: "inventory.csv", type: "file", ext: "csv", size: "1.8 KB", modified: "Feb 17, 2026" },
      { name: "readme.md", type: "file", ext: "md", size: "2.1 KB", modified: "Feb 14, 2026" },
    ],
  },
  {
    name: "Media",
    type: "folder",
    modified: "Feb 21, 2026",
    children: [
      {
        name: "Movies",
        type: "folder",
        modified: "Feb 21, 2026",
        children: [
          { name: "inception.mkv", type: "file", ext: "mkv", size: "4.2 GB", modified: "Jan 10, 2026" },
          { name: "interstellar.mkv", type: "file", ext: "mkv", size: "3.8 GB", modified: "Jan 12, 2026" },
          { name: "the-matrix.mkv", type: "file", ext: "mkv", size: "2.9 GB", modified: "Dec 28, 2025" },
        ],
      },
      {
        name: "Music",
        type: "folder",
        modified: "Feb 19, 2026",
        children: [
          { name: "playlist.m3u", type: "file", ext: "m3u", size: "1.2 KB", modified: "Feb 19, 2026" },
          { name: "album-art.jpg", type: "file", ext: "jpg", size: "280 KB", modified: "Feb 18, 2026" },
        ],
      },
      {
        name: "Photos",
        type: "folder",
        modified: "Feb 20, 2026",
        children: [
          { name: "vacation-2025", type: "folder", modified: "Feb 20, 2026", children: [
            { name: "IMG_0001.jpg", type: "file", ext: "jpg", size: "5.2 MB", modified: "Dec 22, 2025" },
            { name: "IMG_0002.jpg", type: "file", ext: "jpg", size: "4.8 MB", modified: "Dec 22, 2025" },
            { name: "IMG_0003.jpg", type: "file", ext: "jpg", size: "6.1 MB", modified: "Dec 23, 2025" },
          ]},
          { name: "server-rack.jpg", type: "file", ext: "jpg", size: "3.4 MB", modified: "Jan 5, 2026" },
        ],
      },
    ],
  },
  {
    name: "Backups",
    type: "folder",
    modified: "Feb 22, 2026",
    starred: true,
    children: [
      { name: "db-backup-2026-02-22.sql.gz", type: "file", ext: "gz", size: "128 MB", modified: "Feb 22, 2026" },
      { name: "db-backup-2026-02-21.sql.gz", type: "file", ext: "gz", size: "127 MB", modified: "Feb 21, 2026" },
      { name: "config-backup.tar.gz", type: "file", ext: "gz", size: "42 MB", modified: "Feb 20, 2026" },
      { name: "nextcloud-data.tar.gz", type: "file", ext: "gz", size: "2.4 GB", modified: "Feb 19, 2026" },
    ],
  },
  {
    name: "Configs",
    type: "folder",
    modified: "Feb 21, 2026",
    starred: true,
    children: [
      { name: "nginx", type: "folder", modified: "Feb 21, 2026", children: [
        { name: "nginx.conf", type: "file", ext: "conf", size: "3.2 KB", modified: "Feb 21, 2026" },
        { name: "sites-enabled", type: "folder", modified: "Feb 20, 2026", children: [
          { name: "plex.conf", type: "file", ext: "conf", size: "1.1 KB", modified: "Feb 18, 2026" },
          { name: "nextcloud.conf", type: "file", ext: "conf", size: "1.4 KB", modified: "Feb 19, 2026" },
          { name: "grafana.conf", type: "file", ext: "conf", size: "0.9 KB", modified: "Feb 17, 2026" },
        ]},
      ]},
      { name: "docker", type: "folder", modified: "Feb 20, 2026", children: [
        { name: "daemon.json", type: "file", ext: "json", size: "520 B", modified: "Feb 15, 2026" },
      ]},
      { name: ".env", type: "file", ext: "env", size: "1.8 KB", modified: "Feb 20, 2026" },
      { name: "ssh_config", type: "file", ext: "conf", size: "640 B", modified: "Feb 10, 2026" },
    ],
  },
  {
    name: "Downloads",
    type: "folder",
    modified: "Feb 22, 2026",
    children: [
      { name: "portainer-agent.deb", type: "file", ext: "deb", size: "18 MB", modified: "Feb 22, 2026" },
      { name: "ubuntu-22.04.iso", type: "file", ext: "iso", size: "3.6 GB", modified: "Feb 15, 2026" },
      { name: "wireguard-tools.tar.gz", type: "file", ext: "gz", size: "540 KB", modified: "Feb 12, 2026" },
    ],
  },
  {
    name: "Scripts",
    type: "folder",
    modified: "Feb 19, 2026",
    children: [
      { name: "backup.sh", type: "file", ext: "sh", size: "2.4 KB", modified: "Feb 19, 2026", starred: true },
      { name: "deploy.sh", type: "file", ext: "sh", size: "1.8 KB", modified: "Feb 17, 2026" },
      { name: "health-check.py", type: "file", ext: "py", size: "3.1 KB", modified: "Feb 16, 2026" },
      { name: "cleanup-logs.sh", type: "file", ext: "sh", size: "980 B", modified: "Feb 14, 2026" },
      { name: "ssl-renew.sh", type: "file", ext: "sh", size: "1.2 KB", modified: "Feb 10, 2026" },
    ],
  },
  {
    name: "Logs",
    type: "folder",
    modified: "Feb 22, 2026",
    children: [
      { name: "access.log", type: "file", ext: "log", size: "48 MB", modified: "Feb 22, 2026" },
      { name: "error.log", type: "file", ext: "log", size: "2.1 MB", modified: "Feb 22, 2026" },
      { name: "docker.log", type: "file", ext: "log", size: "14 MB", modified: "Feb 22, 2026" },
    ],
  },
  { name: ".bashrc", type: "file", ext: "sh", size: "3.2 KB", modified: "Feb 8, 2026" },
  { name: "notes.txt", type: "file", ext: "txt", size: "1.4 KB", modified: "Feb 20, 2026" },
]

// --- Helpers ---

function getFileIcon(entry: FileEntry) {
  if (entry.type === "folder") {
    return <Folder className="size-4 text-sky-400" />
  }
  const ext = entry.ext?.toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext ?? ""))
    return <FileImage className="size-4 text-pink-400" />
  if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext ?? ""))
    return <FileVideo className="size-4 text-amber-400" />
  if (["gz", "tar", "zip", "rar", "7z", "deb", "iso"].includes(ext ?? ""))
    return <FileArchive className="size-4 text-orange-400" />
  if (["js", "ts", "py", "sh", "json", "yml", "yaml", "conf", "env", "md", "css", "html"].includes(ext ?? ""))
    return <FileCode className="size-4 text-emerald-400" />
  if (["log", "csv"].includes(ext ?? ""))
    return <FileCog className="size-4 text-muted-foreground" />
  if (["txt", "doc", "pdf"].includes(ext ?? ""))
    return <FileText className="size-4 text-blue-300" />
  return <File className="size-4 text-muted-foreground" />
}

function getLargeFileIcon(entry: FileEntry) {
  if (entry.type === "folder") {
    return <Folder className="size-10 text-sky-400" />
  }
  const ext = entry.ext?.toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext ?? ""))
    return <FileImage className="size-10 text-pink-400" />
  if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext ?? ""))
    return <FileVideo className="size-10 text-amber-400" />
  if (["gz", "tar", "zip", "rar", "7z", "deb", "iso"].includes(ext ?? ""))
    return <FileArchive className="size-10 text-orange-400" />
  if (["js", "ts", "py", "sh", "json", "yml", "yaml", "conf", "env", "md", "css", "html"].includes(ext ?? ""))
    return <FileCode className="size-10 text-emerald-400" />
  if (["log", "csv"].includes(ext ?? ""))
    return <FileCog className="size-10 text-muted-foreground" />
  if (["txt", "doc", "pdf"].includes(ext ?? ""))
    return <FileText className="size-10 text-blue-300" />
  return <File className="size-10 text-muted-foreground" />
}

function resolvePath(path: string[]): FileEntry[] {
  let current = fileSystem
  for (const segment of path) {
    const found = current.find((f) => f.name === segment && f.type === "folder")
    if (found?.children) {
      current = found.children
    } else {
      break
    }
  }
  return current
}

function collectStarred(entries: FileEntry[], parentPath: string[] = []): { entry: FileEntry; path: string[] }[] {
  const result: { entry: FileEntry; path: string[] }[] = []
  for (const entry of entries) {
    if (entry.starred) result.push({ entry, path: parentPath })
    if (entry.type === "folder" && entry.children) {
      result.push(...collectStarred(entry.children, [...parentPath, entry.name]))
    }
  }
  return result
}

function getEditorLanguage(entry: FileEntry): string {
  const ext = entry.ext?.toLowerCase()
  if (!ext) return "plaintext"

  if (["js", "mjs", "cjs"].includes(ext)) return "javascript"
  if (["ts", "tsx"].includes(ext)) return "typescript"
  if (["json"].includes(ext)) return "json"
  if (["md"].includes(ext)) return "markdown"
  if (["html", "htm"].includes(ext)) return "html"
  if (["css"].includes(ext)) return "css"
  if (["py"].includes(ext)) return "python"
  if (["sh", "bash", "zsh"].includes(ext)) return "shell"
  if (["yml", "yaml"].includes(ext)) return "yaml"
  if (["xml"].includes(ext)) return "xml"
  if (["sql"].includes(ext)) return "sql"
  if (["ini", "conf", "env"].includes(ext)) return "ini"
  return "plaintext"
}

function makeFileKey(path: string[]) {
  return path.join("/")
}

function getInitialFileContent(entry: FileEntry, path: string[]) {
  const ext = entry.ext?.toLowerCase()
  const fullPath = "/" + path.join("/")

  if (entry.name === "docker-compose.yml") {
    return `version: "3.8"
services:
  nextcloud:
    image: nextcloud:latest
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - ./data:/var/www/html
`
  }

  if (entry.name === "daemon.json") {
    return `{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  },
  "features": {
    "buildkit": true
  }
}`
  }

  if (entry.name === ".env") {
    return `TZ=UTC
PUID=1000
PGID=1000
DOMAIN=home.local
`
  }

  if (ext === "md") {
    return `# ${entry.name}

This is a mock markdown file opened in Monaco Editor.

- Path: \`${fullPath}\`
- Updated: ${entry.modified}
`
  }

  if (ext === "py") {
    return `#!/usr/bin/env python3

def health_check():
    services = ["nextcloud", "grafana", "portainer"]
    for svc in services:
        print(f"[ok] {svc}")

if __name__ == "__main__":
    health_check()
`
  }

  if (ext === "sh") {
    return `#!/bin/bash
set -euo pipefail

echo "Running ${entry.name}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
`
  }

  if (ext === "json") {
    return `{
  "name": "${entry.name}",
  "path": "${fullPath}",
  "updated": "${entry.modified}"
}`
  }

  if (ext === "conf") {
    return `server {
  listen 80;
  server_name home.local;

  location / {
    proxy_pass http://127.0.0.1:3000;
  }
}
`
  }

  if (ext === "log") {
    return `[2026-02-22 11:01:42] INFO  Service started
[2026-02-22 11:03:08] INFO  Health check passed
[2026-02-22 11:05:34] WARN  Slow query detected (182ms)
`
  }

  if (ext === "csv") {
    return `name,ip,status
nextcloud,192.168.1.10,healthy
grafana,192.168.1.20,healthy
portainer,192.168.1.30,degraded
`
  }

  if (ext === "txt") {
    return `File: ${entry.name}
Path: ${fullPath}
Modified: ${entry.modified}
`
  }

  return `# ${entry.name}
# Binary/unsupported preview content`
}

const MONACO_CDN_BASE = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.52.2/min"
let monacoLoaderPromise: Promise<any> | null = null

function loadMonacoFromCdn() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Monaco can only load in the browser"))
  }

  const win = window as typeof window & { monaco?: any; require?: any }
  if (win.monaco?.editor) return Promise.resolve(win.monaco)
  if (monacoLoaderPromise) return monacoLoaderPromise

  monacoLoaderPromise = new Promise((resolve, reject) => {
    const boot = () => {
      if (!win.require) {
        reject(new Error("Monaco loader is unavailable"))
        return
      }
      win.require.config({ paths: { vs: `${MONACO_CDN_BASE}/vs` } })
      win.require(["vs/editor/editor.main"], () => resolve(win.monaco), reject)
    }

    if (win.require) {
      boot()
      return
    }

    const existing = document.getElementById("monaco-loader-script") as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener("load", boot, { once: true })
      existing.addEventListener("error", () => reject(new Error("Failed to load Monaco loader script")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.id = "monaco-loader-script"
    script.src = `${MONACO_CDN_BASE}/vs/loader.min.js`
    script.async = true
    script.onload = boot
    script.onerror = () => reject(new Error("Failed to load Monaco loader script"))
    document.body.appendChild(script)
  })

  return monacoLoaderPromise
}

// --- Sidebar Quick Access ---

type SidebarSection = {
  title: string
  items: { name: string; icon: React.ReactNode; path: string[] }[]
}

const sidebarSections: SidebarSection[] = [
  {
    title: "Favorites",
    items: [
      { name: "Home", icon: <Home className="size-4 text-muted-foreground" />, path: [] },
      { name: "Documents", icon: <FileText className="size-4 text-sky-400" />, path: ["Documents"] },
      { name: "Downloads", icon: <Download className="size-4 text-emerald-400" />, path: ["Downloads"] },
      { name: "Media", icon: <FileVideo className="size-4 text-amber-400" />, path: ["Media"] },
    ],
  },
  {
    title: "Locations",
    items: [
      { name: "Server (4 TB)", icon: <HardDrive className="size-4 text-muted-foreground" />, path: [] },
    ],
  },
]

// --- Component ---

type ViewMode = "grid" | "list"
type SortBy = "name" | "modified" | "size"
type OpenFileState = { path: string[]; entry: FileEntry }

export function FileManager() {
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortBy>("name")
  const [showContextMenu, setShowContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null)
  const [sidebarCollapsed] = useState(false)
  const [openFile, setOpenFile] = useState<OpenFileState | null>(null)
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({})

  const currentEntries = useMemo(() => resolvePath(currentPath), [currentPath])
  const starredItems = useMemo(() => collectStarred(fileSystem), [])

  const sortedEntries = useMemo(() => {
    let entries = [...currentEntries]

    if (searchQuery) {
      entries = entries.filter((e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Folders first, then files
    const folders = entries.filter((e) => e.type === "folder")
    const files = entries.filter((e) => e.type === "file")

    const sortFn = (a: FileEntry, b: FileEntry) => {
      if (sortBy === "name") return a.name.localeCompare(b.name)
      if (sortBy === "modified") return b.modified.localeCompare(a.modified)
      if (sortBy === "size") return (a.size ?? "").localeCompare(b.size ?? "")
      return 0
    }

    return [...folders.sort(sortFn), ...files.sort(sortFn)]
  }, [currentEntries, searchQuery, sortBy])

  const openFileKey = openFile ? makeFileKey(openFile.path) : null
  const openFileLanguage = openFile ? getEditorLanguage(openFile.entry) : "plaintext"
  const openFileContent = openFileKey ? fileDrafts[openFileKey] ?? "" : ""

  function ensureDraft(path: string[], entry: FileEntry) {
    const key = makeFileKey(path)
    setFileDrafts((prev) => {
      if (prev[key] !== undefined) return prev
      return { ...prev, [key]: getInitialFileContent(entry, path) }
    })
  }

  function openFileInEditor(path: string[], entry: FileEntry) {
    ensureDraft(path, entry)
    setOpenFile({ path, entry })
    setSelectedFile(entry.name)
  }

  function navigateTo(entry: FileEntry) {
    if (entry.type === "folder") {
      setCurrentPath((prev) => [...prev, entry.name])
      setSelectedFile(null)
      setOpenFile(null)
      return
    }

    openFileInEditor([...currentPath, entry.name], entry)
  }

  function navigateToPath(path: string[]) {
    setCurrentPath(path)
    setSelectedFile(null)
    setSearchQuery("")
    setOpenFile(null)
  }

  function navigateUp() {
    setCurrentPath((prev) => prev.slice(0, -1))
    setSelectedFile(null)
    setOpenFile(null)
  }

  function handleContextMenu(e: React.MouseEvent, entry: FileEntry) {
    e.preventDefault()
    setShowContextMenu({ x: e.clientX, y: e.clientY, entry })
    setSelectedFile(entry.name)
  }

  // Count items
  const folderCount = sortedEntries.filter((e) => e.type === "folder").length
  const fileCount = sortedEntries.filter((e) => e.type === "file").length

  return (
    <div className="flex h-full" onClick={() => setShowContextMenu(null)}>
      {/* Sidebar */}
      {!sidebarCollapsed && (
        <aside className="w-48 shrink-0 border-r border-glass-border bg-[oklch(0.11_0.01_250/0.5)] flex flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 p-3 pt-4">
            {sidebarSections.map((section) => (
              <div key={section.title}>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
                  {section.title}
                </span>
                <div className="flex flex-col gap-0.5 mt-1.5">
                  {section.items.map((item) => {
                    const isActive = JSON.stringify(item.path) === JSON.stringify(currentPath)
                    return (
                      <button
                        key={item.name}
                        onClick={() => navigateToPath(item.path)}
                        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                          isActive
                            ? "bg-primary/15 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                        }`}
                      >
                        {item.icon}
                        <span className="truncate">{item.name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Starred */}
            {starredItems.length > 0 && (
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
                  Starred
                </span>
                <div className="flex flex-col gap-0.5 mt-1.5">
                  {starredItems.map(({ entry, path }) => (
                    <button
                      key={entry.name}
                      onClick={() => {
                        if (entry.type === "folder") {
                          navigateToPath([...path, entry.name])
                        } else {
                          navigateToPath(path)
                          openFileInEditor([...path, entry.name], entry)
                        }
                      }}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
                    >
                      <Star className="size-3.5 text-amber-400 fill-amber-400" />
                      <span className="truncate">{entry.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Storage bar */}
          <div className="mt-auto p-3 border-t border-glass-border">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-muted-foreground">Storage</span>
              <span className="text-[10px] text-muted-foreground">1.8 TB / 4 TB</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
              <div className="h-full rounded-full bg-primary w-[45%]" />
            </div>
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-glass-border bg-[oklch(0.13_0.012_250/0.5)]">
          {/* Navigation */}
          <div className="flex items-center gap-1">
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
          <nav className="flex items-center gap-1 flex-1 min-w-0" aria-label="File path">
            <button
              onClick={() => navigateToPath([])}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary/40 cursor-pointer shrink-0"
            >
              <HardDrive className="size-3.5" />
            </button>
            {currentPath.map((segment, i) => (
              <div key={i} className="flex items-center gap-1 min-w-0">
                <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
                <button
                  onClick={() => navigateToPath(currentPath.slice(0, i + 1))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded-md hover:bg-secondary/40 truncate max-w-32 cursor-pointer"
                >
                  {segment}
                </button>
              </div>
            ))}
          </nav>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-7 w-36 pl-7 pr-2 rounded-lg bg-secondary/40 border border-glass-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 focus:bg-secondary/60 transition-all"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSortBy((s) => s === "name" ? "modified" : s === "modified" ? "size" : "name")}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors cursor-pointer"
              title={`Sort by: ${sortBy}`}
            >
              <SortAsc className="size-3" />
              <span className="capitalize hidden sm:inline">{sortBy}</span>
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-secondary/30 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "grid" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
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
            <div className="flex h-full flex-col overflow-hidden rounded-xl border border-glass-border bg-[oklch(0.1_0.01_250/0.65)]">
              <div className="flex items-center gap-2 border-b border-glass-border bg-[oklch(0.12_0.012_250/0.7)] px-3 py-2">
                <button
                  onClick={() => setOpenFile(null)}
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                >
                  Back to files
                </button>
                <div className="h-4 w-px bg-border" />
                <div className="flex min-w-0 items-center gap-2">
                  {getFileIcon(openFile.entry)}
                  <span className="truncate text-xs font-medium text-foreground">{openFile.entry.name}</span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                    {openFileLanguage}
                  </span>
                </div>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    if (!openFileKey) return
                    setFileDrafts((prev) => ({ ...prev, [openFileKey]: prev[openFileKey] ?? "" }))
                  }}
                  className="flex items-center gap-1 rounded-md bg-primary/20 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/30"
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
                <MonacoEditorPane
                  key={openFileKey ?? "editor"}
                  language={openFileLanguage}
                  value={openFileContent}
                  onChange={(value) => {
                    if (!openFileKey) return
                    setFileDrafts((prev) => ({ ...prev, [openFileKey]: value }))
                  }}
                />
              </div>
            </div>
          ) : sortedEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <FolderOpen className="size-12 opacity-30" />
              <span className="text-sm">
                {searchQuery ? "No matching files found" : "This folder is empty"}
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
                    <span className="text-[11px] font-medium text-foreground text-center leading-tight line-clamp-2 break-all">
                      {entry.name}
                    </span>
                    {entry.size && (
                      <span className="text-[10px] text-muted-foreground">{entry.size}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {/* List header */}
              <div className="flex items-center gap-3 px-3 py-2 border-b border-glass-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="flex-1 min-w-0">Name</span>
                <span className="w-20 text-right hidden sm:block">Size</span>
                <span className="w-32 text-right hidden md:block">Modified</span>
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
                    <span className="text-xs text-foreground truncate">{entry.name}</span>
                    {entry.starred && <Star className="size-3 text-amber-400 fill-amber-400 shrink-0" />}
                  </div>
                  <span className="w-20 text-right text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                    {entry.size ?? `${entry.children?.length ?? 0} items`}
                  </span>
                  <span className="w-32 text-right text-[11px] text-muted-foreground shrink-0 hidden md:block">
                    {entry.modified}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-glass-border bg-[oklch(0.11_0.01_250/0.4)] text-[10px] text-muted-foreground">
          <span>
            {folderCount > 0 && `${folderCount} folder${folderCount > 1 ? "s" : ""}`}
            {folderCount > 0 && fileCount > 0 && ", "}
            {fileCount > 0 && `${fileCount} file${fileCount > 1 ? "s" : ""}`}
          </span>
          <span className="font-mono">
            /{currentPath.join("/")}
          </span>
        </div>
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-[200] min-w-44 py-1.5 rounded-xl bg-popover border border-glass-border backdrop-blur-2xl shadow-2xl shadow-black/50"
          style={{ left: showContextMenu.x, top: showContextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <ContextMenuItem icon={<FolderOpen className="size-3.5" />} label="Open" onClick={() => { navigateTo(showContextMenu.entry); setShowContextMenu(null) }} />
          <ContextMenuItem icon={<Info className="size-3.5" />} label="Get Info" onClick={() => setShowContextMenu(null)} />
          <div className="h-px bg-border mx-2 my-1" />
          <ContextMenuItem icon={<Copy className="size-3.5" />} label="Copy" onClick={() => setShowContextMenu(null)} />
          <ContextMenuItem icon={<Scissors className="size-3.5" />} label="Cut" onClick={() => setShowContextMenu(null)} />
          <ContextMenuItem icon={<ClipboardPaste className="size-3.5" />} label="Paste" onClick={() => setShowContextMenu(null)} />
          <div className="h-px bg-border mx-2 my-1" />
          <ContextMenuItem icon={<Star className="size-3.5 text-amber-400" />} label="Toggle Star" onClick={() => setShowContextMenu(null)} />
          <ContextMenuItem icon={<Trash2 className="size-3.5 text-status-red" />} label="Move to Trash" danger onClick={() => setShowContextMenu(null)} />
        </div>
      )}
    </div>
  )
}

function MonacoEditorPane({
  language,
  value,
  onChange,
}: {
  language: string
  value: string
  onChange: (value: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const [fallbackMode, setFallbackMode] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    let mounted = true
    let editor: any
    let resizeObserver: ResizeObserver | null = null

    loadMonacoFromCdn()
      .then((monaco) => {
        if (!mounted || !containerRef.current) return
        const model = monaco.editor.createModel(value, language)
        editor = monaco.editor.create(containerRef.current, {
          model,
          theme: "vs-dark",
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize: 13,
          lineHeight: 20,
          scrollBeyondLastLine: false,
          roundedSelection: false,
          padding: { top: 12, bottom: 12 },
        })

        const changeSub = editor.onDidChangeModelContent(() => {
          onChangeRef.current(editor.getValue())
        })

        if (typeof ResizeObserver !== "undefined" && containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            editor.layout()
          })
          resizeObserver.observe(containerRef.current)
        }

        editor.__changeSub = changeSub
      })
      .catch(() => {
        if (mounted) setFallbackMode(true)
      })

    return () => {
      mounted = false
      resizeObserver?.disconnect()
      if (editor?.__changeSub) editor.__changeSub.dispose()
      if (editor?.getModel?.()) editor.getModel().dispose()
      if (editor?.dispose) editor.dispose()
    }
  }, [language])

  if (fallbackMode) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-glass-border bg-status-amber/10 px-3 py-2 text-[11px] text-status-amber">
          Monaco failed to load. Showing fallback editor.
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full w-full resize-none border-0 bg-[#0f1119] p-4 font-mono text-[13px] leading-5 text-foreground outline-none"
          spellCheck={false}
        />
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full bg-[#0f1119]" />
}

function ContextMenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 w-full px-3 py-1.5 text-xs transition-colors cursor-pointer ${
        danger
          ? "text-status-red hover:bg-status-red/10"
          : "text-foreground hover:bg-secondary/50"
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
