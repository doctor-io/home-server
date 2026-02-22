"use client"

import { useState, useMemo } from "react"
import {
  Search,
  Download,
  Trash2,
  RefreshCw,
  Star,
  ExternalLink,
  CheckCircle2,
  Loader2,
  ArrowUpCircle,
  Shield,
  Film,
  Cloud,
  Home,
  Container,
  BarChart3,
  Globe,
  Lock,
  Database,
  Music,
  BookOpen,
  Gamepad2,
  Code,
  Camera,
  Mail,
  MessageSquare,
  Rss,
  Server,
  MonitorSpeaker,
  Cpu,
  Network,
  Radio,
  HardDrive,
  Eye,
  FileText,
  Bot,
  Clapperboard,
  GitBranch,
  Boxes,
  Gauge,
  type LucideIcon,
} from "lucide-react"

type AppStatus = "installed" | "not_installed" | "update_available" | "installing" | "uninstalling" | "updating"

type StoreApp = {
  id: string
  name: string
  icon: LucideIcon
  color: string
  bgColor: string
  category: string
  rating: number
  downloads: string
  version: string
  latestVersion: string
  size: string
  description: string
  developer: string
  status: AppStatus
}

const storeApps: StoreApp[] = [
  // Installed apps
  { id: "plex", name: "Plex Media Server", icon: Film, color: "text-amber-400", bgColor: "bg-amber-500/20", category: "Media", rating: 4.8, downloads: "2.1M", version: "1.40.1", latestVersion: "1.40.1", size: "348 MB", description: "Stream your media library to any device. The leading media server for your home.", developer: "Plex Inc.", status: "installed" },
  { id: "nextcloud", name: "Nextcloud", icon: Cloud, color: "text-sky-400", bgColor: "bg-sky-500/20", category: "Productivity", rating: 4.6, downloads: "1.8M", version: "28.0.2", latestVersion: "29.0.0", size: "1.02 GB", description: "Self-hosted file sync and share solution. Your own cloud storage platform.", developer: "Nextcloud GmbH", status: "update_available" },
  { id: "pihole", name: "Pi-hole", icon: Shield, color: "text-red-400", bgColor: "bg-red-500/20", category: "Network", rating: 4.9, downloads: "3.2M", version: "5.18.2", latestVersion: "5.18.2", size: "289 MB", description: "Network-wide ad blocking via your own DNS server. Protect all your devices.", developer: "Pi-hole LLC", status: "installed" },
  { id: "home-assistant", name: "Home Assistant", icon: Home, color: "text-cyan-400", bgColor: "bg-cyan-500/20", category: "Automation", rating: 4.7, downloads: "2.8M", version: "2024.12.1", latestVersion: "2025.2.0", size: "1.84 GB", description: "Open source home automation platform. Control all your smart devices.", developer: "Nabu Casa", status: "update_available" },
  { id: "portainer", name: "Portainer", icon: Container, color: "text-blue-400", bgColor: "bg-blue-500/20", category: "System", rating: 4.5, downloads: "1.2M", version: "2.20.1", latestVersion: "2.20.1", size: "297 MB", description: "Universal container management platform. Manage Docker with ease.", developer: "Portainer.io", status: "installed" },
  { id: "grafana", name: "Grafana", icon: BarChart3, color: "text-orange-400", bgColor: "bg-orange-500/20", category: "Monitoring", rating: 4.7, downloads: "2.4M", version: "10.3.1", latestVersion: "10.3.1", size: "412 MB", description: "Open-source analytics and monitoring solution for every database.", developer: "Grafana Labs", status: "installed" },
  { id: "vaultwarden", name: "Vaultwarden", icon: Lock, color: "text-indigo-400", bgColor: "bg-indigo-500/20", category: "Security", rating: 4.9, downloads: "890K", version: "1.30.3", latestVersion: "1.30.3", size: "242 MB", description: "Lightweight Bitwarden-compatible password manager server.", developer: "Community", status: "installed" },
  { id: "jellyfin", name: "Jellyfin", icon: Music, color: "text-sky-300", bgColor: "bg-sky-600/20", category: "Media", rating: 4.6, downloads: "1.1M", version: "10.8.13", latestVersion: "10.9.0", size: "578 MB", description: "Free software media system. Stream to any device from your own server.", developer: "Jellyfin Project", status: "update_available" },

  // Not installed apps
  { id: "wireguard", name: "WireGuard VPN", icon: Network, color: "text-teal-400", bgColor: "bg-teal-500/20", category: "Network", rating: 4.9, downloads: "4.1M", version: "", latestVersion: "1.0.20", size: "12 MB", description: "Modern, fast, and lean VPN tunnel. Simplest and fastest VPN available.", developer: "Jason Donenfeld", status: "not_installed" },
  { id: "adguard", name: "AdGuard Home", icon: Eye, color: "text-emerald-400", bgColor: "bg-emerald-500/20", category: "Network", rating: 4.8, downloads: "1.9M", version: "", latestVersion: "0.107.44", size: "45 MB", description: "Network-wide ad and tracker blocking DNS server with parental controls.", developer: "AdGuard", status: "not_installed" },
  { id: "prometheus", name: "Prometheus", icon: Gauge, color: "text-orange-300", bgColor: "bg-orange-600/20", category: "Monitoring", rating: 4.5, downloads: "980K", version: "", latestVersion: "2.50.0", size: "198 MB", description: "Open-source monitoring and alerting toolkit for cloud-native environments.", developer: "CNCF", status: "not_installed" },
  { id: "gitea", name: "Gitea", icon: GitBranch, color: "text-green-400", bgColor: "bg-green-600/20", category: "Development", rating: 4.6, downloads: "720K", version: "", latestVersion: "1.21.5", size: "102 MB", description: "Lightweight self-hosted Git service. Fast, simple, and painless.", developer: "Gitea Community", status: "not_installed" },
  { id: "immich", name: "Immich", icon: Camera, color: "text-pink-400", bgColor: "bg-pink-500/20", category: "Media", rating: 4.8, downloads: "650K", version: "", latestVersion: "1.94.0", size: "890 MB", description: "Self-hosted photo and video backup solution directly from your mobile phone.", developer: "Alex Tran", status: "not_installed" },
  { id: "homepage", name: "Homepage", icon: Globe, color: "text-blue-300", bgColor: "bg-blue-500/20", category: "Productivity", rating: 4.4, downloads: "540K", version: "", latestVersion: "0.8.8", size: "67 MB", description: "A highly customizable homepage with Docker and service integrations.", developer: "Ben Phelps", status: "not_installed" },
  { id: "n8n", name: "n8n Automation", icon: Bot, color: "text-rose-400", bgColor: "bg-rose-500/20", category: "Automation", rating: 4.6, downloads: "480K", version: "", latestVersion: "1.26.0", size: "356 MB", description: "Workflow automation tool. Connect anything to everything.", developer: "n8n GmbH", status: "not_installed" },
  { id: "photoprism", name: "PhotoPrism", icon: Clapperboard, color: "text-fuchsia-400", bgColor: "bg-fuchsia-500/20", category: "Media", rating: 4.5, downloads: "420K", version: "", latestVersion: "231128", size: "1.1 GB", description: "AI-powered photo management. Browse, organize, and share your photo collection.", developer: "PhotoPrism UG", status: "not_installed" },
  { id: "paperless", name: "Paperless-ngx", icon: FileText, color: "text-lime-400", bgColor: "bg-lime-500/20", category: "Productivity", rating: 4.7, downloads: "380K", version: "", latestVersion: "2.4.3", size: "425 MB", description: "Document management system that transforms physical docs into searchable archives.", developer: "Paperless-ngx", status: "not_installed" },
  { id: "minecraft", name: "Minecraft Server", icon: Gamepad2, color: "text-green-400", bgColor: "bg-green-500/20", category: "Gaming", rating: 4.3, downloads: "1.5M", version: "", latestVersion: "1.20.4", size: "325 MB", description: "Dedicated Minecraft Java server. Host your own survival or creative world.", developer: "Mojang", status: "not_installed" },
  { id: "emby", name: "Emby Server", icon: MonitorSpeaker, color: "text-emerald-300", bgColor: "bg-emerald-600/20", category: "Media", rating: 4.2, downloads: "620K", version: "", latestVersion: "4.8.3", size: "490 MB", description: "Personal media server with live TV, DVR, and parental controls.", developer: "Emby LLC", status: "not_installed" },
  { id: "uptime-kuma", name: "Uptime Kuma", icon: Server, color: "text-lime-400", bgColor: "bg-lime-500/20", category: "Monitoring", rating: 4.8, downloads: "910K", version: "", latestVersion: "1.23.11", size: "187 MB", description: "Self-hosted monitoring tool. Monitor HTTP, TCP, DNS, and more.", developer: "Louis Lam", status: "not_installed" },
  { id: "syncthing", name: "Syncthing", icon: RefreshCw, color: "text-sky-300", bgColor: "bg-sky-500/20", category: "Productivity", rating: 4.7, downloads: "1.3M", version: "", latestVersion: "1.27.3", size: "23 MB", description: "Continuous file synchronization. Sync files between devices securely.", developer: "Syncthing Foundation", status: "not_installed" },
  { id: "tailscale", name: "Tailscale", icon: Radio, color: "text-blue-400", bgColor: "bg-blue-600/20", category: "Network", rating: 4.8, downloads: "2.2M", version: "", latestVersion: "1.60.1", size: "35 MB", description: "Zero config VPN that just works. Mesh networking made simple.", developer: "Tailscale Inc.", status: "not_installed" },
]

const categories = ["All", ...Array.from(new Set(storeApps.map((a) => a.category))).sort()]

function StatusBadge({ status }: { status: AppStatus }) {
  switch (status) {
    case "installed":
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-status-green">
          <CheckCircle2 className="size-3" /> Installed
        </span>
      )
    case "update_available":
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-status-amber">
          <ArrowUpCircle className="size-3" /> Update
        </span>
      )
    case "installing":
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-primary animate-pulse">
          <Loader2 className="size-3 animate-spin" /> Installing...
        </span>
      )
    case "updating":
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-primary animate-pulse">
          <Loader2 className="size-3 animate-spin" /> Updating...
        </span>
      )
    case "uninstalling":
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-status-red animate-pulse">
          <Loader2 className="size-3 animate-spin" /> Removing...
        </span>
      )
    default:
      return null
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`size-3 ${s <= Math.round(rating) ? "fill-status-amber text-status-amber" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="ml-1 text-[10px] text-muted-foreground">{rating}</span>
    </div>
  )
}

export function AppStore() {
  const [apps, setApps] = useState(storeApps)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [filter, setFilter] = useState<"all" | "installed" | "updates">("all")
  const [selectedApp, setSelectedApp] = useState<StoreApp | null>(null)

  const filtered = useMemo(() => {
    return apps.filter((a) => {
      const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.description.toLowerCase().includes(search.toLowerCase())
      const matchCat = category === "All" || a.category === category
      const matchFilter =
        filter === "all" ||
        (filter === "installed" && (a.status === "installed" || a.status === "update_available")) ||
        (filter === "updates" && a.status === "update_available")
      return matchSearch && matchCat && matchFilter
    })
  }, [apps, search, category, filter])

  const updateCount = apps.filter((a) => a.status === "update_available").length
  const installedCount = apps.filter((a) => a.status === "installed" || a.status === "update_available").length

  function doAction(id: string, action: "install" | "update" | "uninstall") {
    const inProgressStatus: AppStatus =
      action === "install" ? "installing" : action === "update" ? "updating" : "uninstalling"

    setApps((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: inProgressStatus } : a))
    )

    // Simulate async operation
    setTimeout(() => {
      setApps((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a
          if (action === "uninstall") return { ...a, status: "not_installed" as AppStatus, version: "" }
          return { ...a, status: "installed" as AppStatus, version: a.latestVersion }
        })
      )
      // Also update selectedApp if viewing detail
      setSelectedApp((prev) => {
        if (!prev || prev.id !== id) return prev
        if (action === "uninstall") return { ...prev, status: "not_installed", version: "" }
        return { ...prev, status: "installed", version: prev.latestVersion }
      })
    }, 2000 + Math.random() * 1500)
  }

  // Detail view
  if (selectedApp) {
    const app = apps.find((a) => a.id === selectedApp.id) || selectedApp
    return (
      <div className="flex flex-col h-full">
        {/* Back header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-glass-border shrink-0">
          <button
            onClick={() => setSelectedApp(null)}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            {"< Back to Store"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* App header */}
          <div className="flex items-start gap-5 mb-6">
            <div className={`size-20 rounded-3xl flex items-center justify-center ${app.bgColor} ${app.color} shadow-lg shadow-black/20 shrink-0`}>
              <app.icon className="size-10" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-foreground">{app.name}</h2>
              <p className="text-xs text-muted-foreground mb-2">{app.developer}</p>
              <div className="flex items-center gap-4 mb-3">
                <StarRating rating={app.rating} />
                <span className="text-[10px] text-muted-foreground">{app.downloads} downloads</span>
              </div>
              <div className="flex items-center gap-2">
                {app.status === "not_installed" && (
                  <button
                    onClick={() => doAction(app.id, "install")}
                    className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all cursor-pointer"
                  >
                    Install
                  </button>
                )}
                {app.status === "installed" && (
                  <>
                    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-status-green bg-status-green/10 rounded-lg">
                      <CheckCircle2 className="size-3.5" /> Installed
                    </span>
                    <button
                      onClick={() => doAction(app.id, "uninstall")}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-status-red bg-status-red/10 rounded-lg hover:bg-status-red/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3" /> Uninstall
                    </button>
                  </>
                )}
                {app.status === "update_available" && (
                  <>
                    <button
                      onClick={() => doAction(app.id, "update")}
                      className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all cursor-pointer"
                    >
                      <ArrowUpCircle className="size-3.5" /> Update to {app.latestVersion}
                    </button>
                    <button
                      onClick={() => doAction(app.id, "uninstall")}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-status-red bg-status-red/10 rounded-lg hover:bg-status-red/20 transition-colors cursor-pointer"
                    >
                      <Trash2 className="size-3" /> Uninstall
                    </button>
                  </>
                )}
                {(app.status === "installing" || app.status === "updating" || app.status === "uninstalling") && (
                  <span className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-lg">
                    <Loader2 className="size-3.5 animate-spin" />
                    {app.status === "installing" ? "Installing..." : app.status === "updating" ? "Updating..." : "Removing..."}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Version", value: app.version || app.latestVersion },
              { label: "Size", value: app.size },
              { label: "Category", value: app.category },
              { label: "Downloads", value: app.downloads },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-1 p-3 rounded-xl bg-glass border border-glass-border">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
                <span className="text-sm font-medium text-foreground">{item.value}</span>
              </div>
            ))}
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">About</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{app.description}</p>
          </div>

          {/* Changelog if update available */}
          {(app.status === "update_available" || (app.version && app.version !== app.latestVersion)) && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">{"What's New in " + app.latestVersion}</h3>
              <div className="p-3 rounded-xl bg-glass border border-glass-border text-xs text-muted-foreground leading-relaxed">
                <ul className="list-disc list-inside space-y-1">
                  <li>Performance improvements and bug fixes</li>
                  <li>Updated security patches</li>
                  <li>New configuration options</li>
                  <li>Improved Docker compatibility</li>
                </ul>
              </div>
            </div>
          )}

          {/* Links section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Links</h3>
            <div className="flex items-center gap-3">
              {["Documentation", "GitHub", "Community"].map((link) => (
                <button
                  key={link}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  <ExternalLink className="size-3" /> {link}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Main store list view
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-glass-border shrink-0">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-glass rounded-lg p-0.5">
          {[
            { key: "all" as const, label: "All Apps" },
            { key: "installed" as const, label: `Installed (${installedCount})` },
            { key: "updates" as const, label: `Updates (${updateCount})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                filter === f.key
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-glass border border-glass-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        {/* Update all */}
        {updateCount > 0 && (
          <button
            onClick={() => {
              apps.filter((a) => a.status === "update_available").forEach((a) => doAction(a.id, "update"))
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-primary text-primary-foreground rounded-lg hover:brightness-110 transition-all cursor-pointer"
          >
            <RefreshCw className="size-3" /> Update All
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Category sidebar */}
        <aside className="w-40 shrink-0 border-r border-glass-border p-3 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 px-2">Categories</p>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`flex items-center w-full px-2 py-1.5 rounded-lg text-xs transition-all cursor-pointer mb-0.5 ${
                category === cat
                  ? "bg-primary/15 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </aside>

        {/* App list */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <Search className="size-8 opacity-30" />
              <span className="text-sm">No apps found</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {filtered.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/40 border border-transparent hover:border-glass-border transition-all cursor-pointer text-left"
                >
                  {/* Icon */}
                  <div className={`size-12 rounded-2xl flex items-center justify-center ${app.bgColor} ${app.color} shadow-md shadow-black/15 shrink-0`}>
                    <app.icon className="size-6" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{app.name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{app.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <StarRating rating={app.rating} />
                      <span className="text-[10px] text-muted-foreground">{app.size}</span>
                    </div>
                  </div>

                  {/* Action / status */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <StatusBadge status={app.status} />
                    {app.status === "not_installed" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); doAction(app.id, "install"); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors cursor-pointer"
                      >
                        <Download className="size-3" /> Install
                      </button>
                    )}
                    {app.status === "update_available" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); doAction(app.id, "update"); }}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium bg-primary/15 text-primary rounded-md hover:bg-primary/25 transition-colors cursor-pointer"
                      >
                        <ArrowUpCircle className="size-3" /> Update
                      </button>
                    )}
                    {app.status === "installed" && (
                      <span className="text-[10px] text-muted-foreground">v{app.version}</span>
                    )}
                    {(app.status === "installing" || app.status === "updating" || app.status === "uninstalling") && (
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary animate-pulse w-3/4" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
