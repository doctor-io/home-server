"use client"

import { useState } from "react"
import {
  Server,
  Shield,
  BarChart3,
  Cloud,
  Film,
  FolderOpen,
  Home,
  Container,
  Globe,
  Lock,
  Download,
  Database,
  Music,
  BookOpen,
  Gamepad2,
  Code,
  Camera,
  Mail,
  MessageSquare,
  Rss,
} from "lucide-react"

type AppItem = {
  name: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
  status: "running" | "stopped" | "updating"
  category: string
}

const apps: AppItem[] = [
  { name: "Plex", icon: Film, color: "text-amber-400", bgColor: "bg-amber-500/20", status: "running", category: "Media" },
  { name: "Nextcloud", icon: Cloud, color: "text-sky-400", bgColor: "bg-sky-500/20", status: "running", category: "Productivity" },
  { name: "Pi-hole", icon: Shield, color: "text-red-400", bgColor: "bg-red-500/20", status: "running", category: "Network" },
  { name: "Home Asst.", icon: Home, color: "text-cyan-400", bgColor: "bg-cyan-500/20", status: "running", category: "Automation" },
  { name: "Portainer", icon: Container, color: "text-blue-400", bgColor: "bg-blue-500/20", status: "running", category: "System" },
  { name: "Grafana", icon: BarChart3, color: "text-orange-400", bgColor: "bg-orange-500/20", status: "running", category: "System" },
  { name: "Nginx Proxy", icon: Globe, color: "text-emerald-400", bgColor: "bg-emerald-500/20", status: "running", category: "Network" },
  { name: "Vaultwarden", icon: Lock, color: "text-indigo-400", bgColor: "bg-indigo-500/20", status: "running", category: "Security" },
  { name: "qBittorrent", icon: Download, color: "text-teal-400", bgColor: "bg-teal-500/20", status: "stopped", category: "Downloads" },
  { name: "PostgreSQL", icon: Database, color: "text-blue-300", bgColor: "bg-blue-600/20", status: "running", category: "System" },
  { name: "Jellyfin", icon: Music, color: "text-sky-300", bgColor: "bg-sky-600/20", status: "running", category: "Media" },
  { name: "Gitea", icon: Code, color: "text-green-400", bgColor: "bg-green-600/20", status: "running", category: "Development" },
  { name: "Immich", icon: Camera, color: "text-pink-400", bgColor: "bg-pink-500/20", status: "updating", category: "Media" },
  { name: "Bookstack", icon: BookOpen, color: "text-yellow-400", bgColor: "bg-yellow-600/20", status: "running", category: "Productivity" },
  { name: "File Browser", icon: FolderOpen, color: "text-stone-400", bgColor: "bg-stone-500/20", status: "running", category: "Productivity" },
  { name: "Uptime Kuma", icon: Server, color: "text-lime-400", bgColor: "bg-lime-500/20", status: "running", category: "System" },
  { name: "Mailcow", icon: Mail, color: "text-rose-400", bgColor: "bg-rose-500/20", status: "stopped", category: "Communication" },
  { name: "Matrix", icon: MessageSquare, color: "text-emerald-300", bgColor: "bg-emerald-600/20", status: "running", category: "Communication" },
  { name: "FreshRSS", icon: Rss, color: "text-orange-300", bgColor: "bg-orange-600/20", status: "running", category: "Productivity" },
  { name: "Minecraft", icon: Gamepad2, color: "text-green-400", bgColor: "bg-green-500/20", status: "stopped", category: "Gaming" },
]

const categories = ["All", ...Array.from(new Set(apps.map((a) => a.category)))]

export function AppGrid() {
  const [selectedCategory, setSelectedCategory] = useState("All")

  const filtered =
    selectedCategory === "All"
      ? apps
      : apps.filter((a) => a.category === selectedCategory)

  return (
    <section className="flex-1 px-6 pt-4 pb-6 overflow-y-auto">
      {/* Category filter pills */}
      <nav className="flex items-center gap-2 mb-8 flex-wrap" aria-label="Filter by category">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              selectedCategory === cat
                ? "bg-primary/20 text-primary border border-primary/30"
                : "bg-glass border border-glass-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {cat}
          </button>
        ))}
      </nav>

      {/* App icon grid - like a real desktop */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-x-2 gap-y-5">
        {filtered.map((app) => (
          <button
            key={app.name}
            className="group flex flex-col items-center gap-2 p-2 rounded-xl hover:bg-foreground/5 transition-all duration-200 cursor-pointer"
            aria-label={`Open ${app.name}`}
          >
            {/* Icon */}
            <div className="relative">
              <div
                className={`size-14 rounded-2xl flex items-center justify-center ${app.bgColor} ${app.color} shadow-lg shadow-black/20 transition-transform duration-200 group-hover:scale-110 group-active:scale-95`}
              >
                <app.icon className="size-7" />
              </div>
              {/* Status dot */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background ${
                  app.status === "running"
                    ? "bg-status-green"
                    : app.status === "updating"
                    ? "bg-status-amber animate-pulse"
                    : "bg-muted-foreground/40"
                }`}
              />
            </div>

            {/* Name */}
            <span className="text-[11px] font-medium text-foreground/90 leading-tight text-center max-w-[72px] truncate group-hover:text-foreground transition-colors">
              {app.name}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
