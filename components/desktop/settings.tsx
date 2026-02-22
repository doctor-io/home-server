"use client"

import { useState } from "react"
import {
  Server,
  Wifi,
  Shield,
  HardDrive,
  Users,
  Bell,
  Palette,
  Power,
  Container,
  Globe,
  Clock,
  Cpu,
  MemoryStick,
  Thermometer,
  RefreshCw,
  ChevronRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Download,
  Upload,
  Lock,
  Zap,
  MonitorSpeaker,
  Database,
  KeyRound,
  Mail,
  ToggleLeft,
  ToggleRight,
  Info,
  AlertTriangle,
  ExternalLink,
} from "lucide-react"

// =====================
// Types
// =====================

type SettingsSection = {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

// =====================
// Sections Config
// =====================

const sections: SettingsSection[] = [
  { id: "general", label: "General", icon: Server },
  { id: "network", label: "Network", icon: Wifi },
  { id: "storage", label: "Storage", icon: HardDrive },
  { id: "docker", label: "Docker", icon: Container },
  { id: "users", label: "Users & Access", icon: Users },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "backup", label: "Backup & Restore", icon: Database },
  { id: "updates", label: "Updates", icon: RefreshCw, badge: "2" },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "power", label: "Power", icon: Power },
]

// =====================
// Toggle component
// =====================

function Toggle({
  enabled,
  onToggle,
  label,
  description,
}: {
  enabled: boolean
  onToggle: () => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>
      <button
        onClick={onToggle}
        className="cursor-pointer shrink-0"
        aria-label={`Toggle ${label}`}
      >
        {enabled ? (
          <ToggleRight className="size-7 text-primary" />
        ) : (
          <ToggleLeft className="size-7 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}

// =====================
// Input Field
// =====================

function SettingsInput({
  label,
  value,
  placeholder,
  type = "text",
  readOnly,
  copyable,
  description,
}: {
  label: string
  value: string
  placeholder?: string
  type?: string
  readOnly?: boolean
  copyable?: boolean
  description?: string
}) {
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const isPassword = type === "password"

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {description && <span className="text-[11px] text-muted-foreground/70">{description}</span>}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={isPassword && !showPassword ? "password" : "text"}
            defaultValue={value}
            placeholder={placeholder}
            readOnly={readOnly}
            className="h-8 w-full rounded-lg bg-secondary/40 border border-glass-border px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 transition-all read-only:opacity-60"
          />
          {isPassword && (
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          )}
        </div>
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
            className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            {copied ? <Check className="size-3.5 text-status-green" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </div>
    </div>
  )
}

// =====================
// Select Field
// =====================

function SettingsSelect({
  label,
  value,
  options,
  description,
}: {
  label: string
  value: string
  options: string[]
  description?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {description && <span className="text-[11px] text-muted-foreground/70">{description}</span>}
      <select
        defaultValue={value}
        className="h-8 rounded-lg bg-secondary/40 border border-glass-border px-3 text-xs text-foreground focus:outline-none focus:border-primary/40 transition-all cursor-pointer appearance-none"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

// =====================
// Section Divider
// =====================

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-5 pb-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
        {title}
      </span>
      <div className="flex-1 h-px bg-glass-border" />
    </div>
  )
}

// =====================
// Info Banner
// =====================

function InfoBanner({ text, variant = "info" }: { text: string; variant?: "info" | "warning" }) {
  return (
    <div
      className={`flex items-start gap-2.5 p-3 rounded-xl text-xs ${
        variant === "warning"
          ? "bg-status-amber/10 border border-status-amber/20 text-status-amber"
          : "bg-primary/8 border border-primary/15 text-primary"
      }`}
    >
      {variant === "warning" ? (
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
      ) : (
        <Info className="size-4 shrink-0 mt-0.5" />
      )}
      <span className="leading-relaxed">{text}</span>
    </div>
  )
}

// =====================
// Storage Bar
// =====================

function StorageBar({
  label,
  used,
  total,
  unit,
  color,
}: {
  label: string
  used: number
  total: number
  unit: string
  color: string
}) {
  const pct = Math.round((used / total) * 100)
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">
          {used} {unit} / {total} {unit} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// =====================
// User Row
// =====================

function UserRow({
  name,
  role,
  email,
  lastActive,
  avatarColor,
}: {
  name: string
  role: string
  email: string
  lastActive: string
  avatarColor: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div
        className="size-8 rounded-full flex items-center justify-center text-xs font-bold text-foreground shrink-0"
        style={{ backgroundColor: avatarColor }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground">{name}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              role === "Admin"
                ? "bg-primary/15 text-primary"
                : role === "Editor"
                  ? "bg-status-amber/15 text-status-amber"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {role}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{email}</span>
      </div>
      <span className="text-[11px] text-muted-foreground hidden sm:block">{lastActive}</span>
      <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-secondary/50 transition-all text-muted-foreground cursor-pointer">
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  )
}

// =====================
// Docker Container Row
// =====================

function ContainerRow({
  name,
  image,
  status,
  ports,
  cpu,
  memory,
}: {
  name: string
  image: string
  status: "running" | "stopped" | "restarting"
  ports: string
  cpu: string
  memory: string
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div
        className={`size-2 rounded-full shrink-0 ${
          status === "running"
            ? "bg-status-green"
            : status === "restarting"
              ? "bg-status-amber animate-pulse"
              : "bg-muted-foreground/40"
        }`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground font-medium">{name}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{image}</span>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {ports} | CPU: {cpu} | RAM: {memory}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button className="px-2 py-1 text-[10px] rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          {status === "running" ? "Stop" : "Start"}
        </button>
        <button className="px-2 py-1 text-[10px] rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          Restart
        </button>
      </div>
    </div>
  )
}

// =====================
// Update Row
// =====================

function UpdateRow({
  name,
  current,
  available,
  type,
}: {
  name: string
  current: string
  available: string
  type: "system" | "app"
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {type === "system" ? (
          <Cpu className="size-4 text-primary" />
        ) : (
          <Container className="size-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{name}</span>
        <div className="text-[11px] text-muted-foreground">
          {current} <ChevronRight className="size-3 inline" /> {available}
        </div>
      </div>
      <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer">
        Update
      </button>
    </div>
  )
}

// =====================
// Backup Row
// =====================

function BackupRow({
  date,
  size,
  type,
  status,
}: {
  date: string
  size: string
  type: string
  status: "completed" | "failed" | "in-progress"
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className={`size-2 rounded-full shrink-0 ${
          status === "completed"
            ? "bg-status-green"
            : status === "in-progress"
              ? "bg-status-amber animate-pulse"
              : "bg-status-red"
        }`}
      />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground">{type}</span>
        <div className="text-[11px] text-muted-foreground">
          {date} - {size}
        </div>
      </div>
      <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <Download className="size-3.5" />
      </button>
    </div>
  )
}

// =====================
// Section Content
// =====================

function GeneralSection() {
  const [autoStart, setAutoStart] = useState(true)
  const [telemetry, setTelemetry] = useState(false)
  const [remoteAccess, setRemoteAccess] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="System Info" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">Hostname</span>
          <span className="text-sm text-foreground font-medium">serverlab-node01</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">OS</span>
          <span className="text-sm text-foreground">Ubuntu 24.04 LTS</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">Kernel</span>
          <span className="text-sm text-foreground font-mono text-xs">6.8.0-48-generic</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">Architecture</span>
          <span className="text-sm text-foreground">x86_64 (AMD64)</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">Uptime</span>
          <span className="text-sm text-foreground">14 days, 6 hours</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-[11px] text-muted-foreground">ServerLab Version</span>
          <span className="text-sm text-foreground">v2.4.1</span>
        </div>
      </div>

      <SectionDivider title="Hardware" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex items-center gap-2 py-1.5">
          <Cpu className="size-4 text-primary" />
          <div>
            <span className="text-[11px] text-muted-foreground block">Processor</span>
            <span className="text-xs text-foreground">AMD Ryzen 7 5700G (16 threads)</span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <MemoryStick className="size-4 text-primary" />
          <div>
            <span className="text-[11px] text-muted-foreground block">Memory</span>
            <span className="text-xs text-foreground">64 GB DDR4-3200</span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <Thermometer className="size-4 text-status-amber" />
          <div>
            <span className="text-[11px] text-muted-foreground block">CPU Temperature</span>
            <span className="text-xs text-foreground">52 C</span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <MonitorSpeaker className="size-4 text-primary" />
          <div>
            <span className="text-[11px] text-muted-foreground block">GPU</span>
            <span className="text-xs text-foreground">Radeon Vega 8 (integrated)</span>
          </div>
        </div>
      </div>

      <SectionDivider title="Preferences" />
      <SettingsInput label="Hostname" value="serverlab-node01" />
      <SettingsSelect label="Timezone" value="UTC" options={["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai"]} />
      <SettingsSelect label="Language" value="English (US)" options={["English (US)", "English (UK)", "Deutsch", "Francais", "Espanol", "Portugues"]} />
      <Toggle label="Auto-start services on boot" description="Automatically start all enabled services when the server boots" enabled={autoStart} onToggle={() => setAutoStart(!autoStart)} />
      <Toggle label="Remote access" description="Allow remote connections via SSH and web UI" enabled={remoteAccess} onToggle={() => setRemoteAccess(!remoteAccess)} />
      <Toggle label="Anonymous telemetry" description="Send anonymized usage data to help improve ServerLab" enabled={telemetry} onToggle={() => setTelemetry(!telemetry)} />
    </div>
  )
}

function NetworkSection() {
  const [dhcp, setDhcp] = useState(false)
  const [ipv6, setIpv6] = useState(true)
  const [wol, setWol] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Interfaces" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-glass-border">
          <div className="flex items-center gap-3">
            <div className="size-2 rounded-full bg-status-green" />
            <div>
              <span className="text-sm text-foreground font-medium">eth0</span>
              <span className="text-[11px] text-muted-foreground ml-2">Primary</span>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">2.5 Gbps</span>
        </div>
        <div className="grid grid-cols-3 gap-4 p-3">
          <div>
            <span className="text-[10px] text-muted-foreground block">IPv4 Address</span>
            <span className="text-xs text-foreground font-mono">192.168.1.100</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Subnet Mask</span>
            <span className="text-xs text-foreground font-mono">255.255.255.0</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">MAC Address</span>
            <span className="text-xs text-foreground font-mono">A8:4B:6D:F2:1E:C3</span>
          </div>
        </div>
      </div>

      <SectionDivider title="Configuration" />
      <SettingsInput label="Gateway" value="192.168.1.1" />
      <SettingsInput label="DNS Primary" value="1.1.1.1" />
      <SettingsInput label="DNS Secondary" value="8.8.8.8" />
      <SettingsInput label="Domain" value="serverlab.local" />
      <Toggle label="DHCP" description="Automatically obtain IP address from network" enabled={dhcp} onToggle={() => setDhcp(!dhcp)} />
      <Toggle label="IPv6" description="Enable IPv6 networking support" enabled={ipv6} onToggle={() => setIpv6(!ipv6)} />

      <SectionDivider title="Advanced" />
      <Toggle label="Wake-on-LAN" description="Allow remote wake up via network packet" enabled={wol} onToggle={() => setWol(!wol)} />
      <SettingsSelect label="MTU" value="1500" options={["1500", "9000", "Custom"]} description="Maximum Transmission Unit size" />

      <SectionDivider title="Port Forwarding" />
      <InfoBanner text="Port forwarding rules let external traffic reach services on this server. Make sure to configure your router accordingly." />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden mt-2">
        {[
          { ext: "80", int: "80", proto: "TCP", service: "Nginx" },
          { ext: "443", int: "443", proto: "TCP", service: "Nginx (SSL)" },
          { ext: "32400", int: "32400", proto: "TCP", service: "Plex" },
          { ext: "51820", int: "51820", proto: "UDP", service: "WireGuard" },
        ].map((rule, i, arr) => (
          <div key={i} className={`flex items-center justify-between px-3 py-2 text-xs ${i < arr.length - 1 ? "border-b border-glass-border" : ""}`}>
            <span className="text-foreground w-20">{rule.service}</span>
            <span className="text-muted-foreground font-mono">{rule.ext} <ChevronRight className="size-3 inline" /> {rule.int}</span>
            <span className="text-muted-foreground">{rule.proto}</span>
          </div>
        ))}
      </div>
      <button className="mt-2 self-start px-3 py-1.5 text-[11px] font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
        + Add Rule
      </button>
    </div>
  )
}

function StorageSection() {
  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Disks" />
      <StorageBar label="/dev/sda1 - System (NVMe SSD)" used={120} total={500} unit="GB" color="oklch(0.72 0.14 190)" />
      <StorageBar label="/dev/sdb1 - Data Pool 1 (HDD)" used={1800} total={4000} unit="GB" color="oklch(0.65 0.15 160)" />
      <StorageBar label="/dev/sdc1 - Data Pool 2 (HDD)" used={2100} total={4000} unit="GB" color="oklch(0.78 0.12 85)" />
      <StorageBar label="/dev/sdd1 - Backup (HDD)" used={840} total={2000} unit="GB" color="oklch(0.6 0.2 340)" />

      <SectionDivider title="RAID Configuration" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground font-medium">ZFS Pool: datapool</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">Healthy</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">Type</span>
            <span className="text-foreground">RAID-Z1 (raidz)</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Total Size</span>
            <span className="text-foreground">8 TB</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Redundancy</span>
            <span className="text-foreground">1 disk parity</span>
          </div>
        </div>
      </div>

      <SectionDivider title="Shared Folders" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden">
        {[
          { name: "Media", path: "/srv/media", protocol: "SMB / NFS", size: "3.2 TB" },
          { name: "Documents", path: "/srv/documents", protocol: "SMB", size: "48 GB" },
          { name: "Backups", path: "/srv/backups", protocol: "NFS", size: "840 GB" },
          { name: "Public", path: "/srv/public", protocol: "SMB", size: "12 GB" },
        ].map((share, i, arr) => (
          <div key={i} className={`flex items-center justify-between px-3 py-2.5 text-xs ${i < arr.length - 1 ? "border-b border-glass-border" : ""}`}>
            <div className="flex items-center gap-2.5">
              <HardDrive className="size-3.5 text-primary" />
              <div>
                <span className="text-foreground font-medium">{share.name}</span>
                <span className="text-muted-foreground font-mono ml-2">{share.path}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">{share.protocol}</span>
              <span className="text-muted-foreground">{share.size}</span>
            </div>
          </div>
        ))}
      </div>

      <SectionDivider title="S.M.A.R.T. Health" />
      <InfoBanner text="All drives passed the last S.M.A.R.T. diagnostic check (Feb 21, 2026). Next scheduled check: Feb 28, 2026." />
    </div>
  )
}

function DockerSection() {
  const [autoRestart, setAutoRestart] = useState(true)
  const [logRotation, setLogRotation] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Engine Status" />
      <div className="grid grid-cols-3 gap-4 py-2">
        <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 text-center">
          <span className="text-xl font-bold text-foreground">24</span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">Containers</span>
        </div>
        <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 text-center">
          <span className="text-xl font-bold text-status-green">18</span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">Running</span>
        </div>
        <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 text-center">
          <span className="text-xl font-bold text-foreground">42</span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">Images</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-[11px] text-muted-foreground">Docker Version</span>
          <span className="text-xs text-foreground font-mono">26.1.4</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-[11px] text-muted-foreground">Compose Version</span>
          <span className="text-xs text-foreground font-mono">v2.27.0</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-[11px] text-muted-foreground">Storage Driver</span>
          <span className="text-xs text-foreground">overlay2</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-[11px] text-muted-foreground">Cgroup Driver</span>
          <span className="text-xs text-foreground">systemd</span>
        </div>
      </div>

      <SectionDivider title="Containers" />
      <ContainerRow name="plex" image="plexinc/pms-docker:latest" status="running" ports="32400:32400" cpu="3.2%" memory="1.8 GB" />
      <ContainerRow name="nextcloud" image="nextcloud:28" status="running" ports="8080:80" cpu="1.1%" memory="420 MB" />
      <ContainerRow name="pihole" image="pihole/pihole:latest" status="running" ports="53:53, 80:80" cpu="0.4%" memory="128 MB" />
      <ContainerRow name="grafana" image="grafana/grafana:11" status="running" ports="3000:3000" cpu="0.8%" memory="256 MB" />
      <ContainerRow name="home-assistant" image="homeassistant/home-assistant:stable" status="running" ports="8123:8123" cpu="2.4%" memory="890 MB" />
      <ContainerRow name="vaultwarden" image="vaultwarden/server:latest" status="stopped" ports="8081:80" cpu="0%" memory="0 MB" />

      <SectionDivider title="Settings" />
      <SettingsInput label="Data Root" value="/var/lib/docker" readOnly />
      <Toggle label="Auto-restart policy" description="Automatically restart crashed containers" enabled={autoRestart} onToggle={() => setAutoRestart(!autoRestart)} />
      <Toggle label="Log rotation" description="Rotate container logs to prevent disk overuse" enabled={logRotation} onToggle={() => setLogRotation(!logRotation)} />
      <SettingsSelect label="Default Network" value="bridge" options={["bridge", "host", "macvlan", "none"]} />

      <div className="flex items-center gap-2 mt-3">
        <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
          Prune Unused Images
        </button>
        <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
          Prune Volumes
        </button>
      </div>
    </div>
  )
}

function UsersSection() {
  const [twoFactor, setTwoFactor] = useState(true)
  const [sshKeys, setSshKeys] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="User Accounts" />
      <UserRow name="admin" role="Admin" email="admin@serverlab.local" lastActive="Just now" avatarColor="oklch(0.55 0.15 190)" />
      <UserRow name="sarah" role="Editor" email="sarah@home.lan" lastActive="2 hours ago" avatarColor="oklch(0.6 0.15 340)" />
      <UserRow name="media-user" role="Viewer" email="media@home.lan" lastActive="1 day ago" avatarColor="oklch(0.65 0.12 85)" />
      <UserRow name="backup-bot" role="Service" email="backup@serverlab.local" lastActive="12 min ago" avatarColor="oklch(0.5 0.1 250)" />
      <button className="self-start mt-1 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer">
        + Add User
      </button>

      <SectionDivider title="Authentication" />
      <Toggle label="Require two-factor authentication" description="Enforce 2FA for all admin accounts" enabled={twoFactor} onToggle={() => setTwoFactor(!twoFactor)} />
      <SettingsSelect label="Session timeout" value="30 minutes" options={["15 minutes", "30 minutes", "1 hour", "4 hours", "Never"]} description="Auto-logout after period of inactivity" />
      <Toggle label="SSH key authentication" description="Require SSH keys instead of password for remote login" enabled={sshKeys} onToggle={() => setSshKeys(!sshKeys)} />

      <SectionDivider title="API Keys" />
      <InfoBanner text="API keys allow external services and scripts to interact with your server programmatically." />
      <SettingsInput label="Primary API Key" value="sk_live_serverlab_a8B2k9Xm4pQ7rY..." type="password" copyable />
      <button className="self-start mt-1 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
        Regenerate Key
      </button>
    </div>
  )
}

function SecuritySection() {
  const [firewall, setFirewall] = useState(true)
  const [failBan, setFailBan] = useState(true)
  const [autoUpdates, setAutoUpdates] = useState(true)
  const [auditLog, setAuditLog] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Firewall" />
      <Toggle label="UFW Firewall" description="Uncomplicated Firewall for managing inbound/outbound rules" enabled={firewall} onToggle={() => setFirewall(!firewall)} />
      <SettingsSelect label="Default incoming policy" value="Deny" options={["Deny", "Allow", "Reject"]} />
      <SettingsSelect label="Default outgoing policy" value="Allow" options={["Allow", "Deny", "Reject"]} />

      <SectionDivider title="Intrusion Prevention" />
      <Toggle label="Fail2Ban" description="Automatically ban IPs with repeated failed login attempts" enabled={failBan} onToggle={() => setFailBan(!failBan)} />
      <SettingsInput label="Max retries" value="5" description="Number of failed attempts before banning" />
      <SettingsInput label="Ban duration" value="3600" description="Ban time in seconds (3600 = 1 hour)" />

      <SectionDivider title="SSL / TLS" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-status-green" />
            <span className="text-sm text-foreground font-medium">Let&apos;s Encrypt</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">Valid</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">Domain</span>
            <span className="text-foreground">*.serverlab.local</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Expires</span>
            <span className="text-foreground">Apr 22, 2026</span>
          </div>
        </div>
      </div>
      <button className="self-start mt-2 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
        Renew Certificate
      </button>

      <SectionDivider title="VPN" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <span className="text-sm text-foreground font-medium">WireGuard</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">Active</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">Port</span>
            <span className="text-foreground font-mono">51820</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Peers</span>
            <span className="text-foreground">3 connected</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Tunnel IP</span>
            <span className="text-foreground font-mono">10.0.0.1/24</span>
          </div>
        </div>
      </div>

      <SectionDivider title="Audit & Logging" />
      <Toggle label="Security auto-updates" description="Automatically install critical security patches" enabled={autoUpdates} onToggle={() => setAutoUpdates(!autoUpdates)} />
      <Toggle label="Audit logging" description="Record all system access and configuration changes" enabled={auditLog} onToggle={() => setAuditLog(!auditLog)} />
    </div>
  )
}

function NotificationsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [discordNotifs, setDiscordNotifs] = useState(true)
  const [systemAlerts, setSystemAlerts] = useState(true)
  const [updateNotifs, setUpdateNotifs] = useState(true)
  const [backupNotifs, setBackupNotifs] = useState(true)
  const [securityNotifs, setSecurityNotifs] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Channels" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center gap-2.5 mb-2">
          <Mail className="size-4 text-primary" />
          <span className="text-sm text-foreground font-medium">Email (SMTP)</span>
        </div>
        <SettingsInput label="SMTP Server" value="smtp.gmail.com" />
        <SettingsInput label="Port" value="587" />
        <SettingsInput label="Username" value="serverlab.alerts@gmail.com" />
        <SettingsInput label="Password" value="app-specific-password" type="password" />
        <SettingsInput label="Recipient" value="admin@home.lan" />
        <Toggle label="Enable email notifications" enabled={emailNotifs} onToggle={() => setEmailNotifs(!emailNotifs)} />
      </div>

      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 mt-2">
        <div className="flex items-center gap-2.5 mb-2">
          <Globe className="size-4 text-[#5865F2]" />
          <span className="text-sm text-foreground font-medium">Discord Webhook</span>
        </div>
        <SettingsInput label="Webhook URL" value="https://discord.com/api/webhooks/1234..." type="password" />
        <Toggle label="Enable Discord notifications" enabled={discordNotifs} onToggle={() => setDiscordNotifs(!discordNotifs)} />
      </div>

      <SectionDivider title="Alert Types" />
      <Toggle label="System alerts" description="CPU overload, high temperature, low disk space" enabled={systemAlerts} onToggle={() => setSystemAlerts(!systemAlerts)} />
      <Toggle label="Update notifications" description="New versions available for apps and system" enabled={updateNotifs} onToggle={() => setUpdateNotifs(!updateNotifs)} />
      <Toggle label="Backup reports" description="Backup success/failure notifications" enabled={backupNotifs} onToggle={() => setBackupNotifs(!backupNotifs)} />
      <Toggle label="Security events" description="Failed logins, firewall blocks, certificate expiry" enabled={securityNotifs} onToggle={() => setSecurityNotifs(!securityNotifs)} />

      <SectionDivider title="Thresholds" />
      <SettingsInput label="CPU usage alert threshold" value="90" description="Trigger alert when CPU usage exceeds this %" />
      <SettingsInput label="Memory alert threshold" value="85" description="Trigger alert when RAM usage exceeds this %" />
      <SettingsInput label="Disk space alert threshold" value="90" description="Trigger alert when disk usage exceeds this %" />
      <SettingsInput label="Temperature alert threshold" value="80" description="Trigger alert when CPU temp exceeds this (Celsius)" />
    </div>
  )
}

function BackupSection() {
  const [autoBackup, setAutoBackup] = useState(true)
  const [encryptBackups, setEncryptBackups] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Backup Schedule" />
      <Toggle label="Automatic backups" description="Run scheduled backups automatically" enabled={autoBackup} onToggle={() => setAutoBackup(!autoBackup)} />
      <SettingsSelect label="Frequency" value="Daily" options={["Hourly", "Daily", "Weekly", "Monthly"]} />
      <SettingsSelect label="Time" value="03:00 AM" options={["12:00 AM", "01:00 AM", "02:00 AM", "03:00 AM", "04:00 AM", "05:00 AM", "06:00 AM"]} />
      <SettingsInput label="Retention" value="30" description="Number of backups to keep before rotating" />

      <SectionDivider title="Backup Target" />
      <SettingsSelect label="Destination" value="Local + Remote" options={["Local Only", "Remote Only", "Local + Remote"]} />
      <SettingsInput label="Local path" value="/srv/backups" readOnly />
      <SettingsInput label="Remote (S3-compatible)" value="s3://my-bucket/serverlab-backups/" />
      <SettingsInput label="Access Key" value="AKIAIOSFODNN7EXAMPLE" type="password" copyable />
      <SettingsInput label="Secret Key" value="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" type="password" />

      <SectionDivider title="Encryption" />
      <Toggle label="Encrypt backups" description="AES-256 encryption for all backup archives" enabled={encryptBackups} onToggle={() => setEncryptBackups(!encryptBackups)} />
      <SettingsInput label="Encryption passphrase" value="super-secret-backup-key" type="password" copyable />

      <SectionDivider title="What to Back Up" />
      {[
        { name: "Application data", desc: "Docker volumes, app configs", size: "~12 GB", checked: true },
        { name: "Database dumps", desc: "PostgreSQL, MariaDB, Redis", size: "~4.2 GB", checked: true },
        { name: "System configuration", desc: "/etc, crontabs, SSH keys", size: "~120 MB", checked: true },
        { name: "User media", desc: "Photos, documents, uploads", size: "~180 GB", checked: false },
        { name: "Logs", desc: "Application and system logs", size: "~2.8 GB", checked: false },
      ].map((item) => (
        <div key={item.name} className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              defaultChecked={item.checked}
              className="size-4 rounded accent-[oklch(0.72_0.14_190)] cursor-pointer"
            />
            <div>
              <span className="text-sm text-foreground">{item.name}</span>
              <span className="text-[11px] text-muted-foreground block">{item.desc}</span>
            </div>
          </div>
          <span className="text-[11px] text-muted-foreground">{item.size}</span>
        </div>
      ))}

      <SectionDivider title="Recent Backups" />
      <BackupRow date="Feb 22, 2026 03:00 AM" size="14.8 GB" type="Full Backup" status="completed" />
      <BackupRow date="Feb 21, 2026 03:00 AM" size="14.6 GB" type="Full Backup" status="completed" />
      <BackupRow date="Feb 20, 2026 03:00 AM" size="14.5 GB" type="Full Backup" status="completed" />
      <BackupRow date="Feb 19, 2026 03:00 AM" size="14.2 GB" type="Full Backup" status="failed" />

      <div className="flex items-center gap-2 mt-3">
        <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer flex items-center gap-1.5">
          <Upload className="size-3" />
          Run Backup Now
        </button>
        <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5">
          <Download className="size-3" />
          Restore from Backup
        </button>
      </div>
    </div>
  )
}

function UpdatesSection() {
  const [autoCheck, setAutoCheck] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Available Updates" />
      <UpdateRow name="ServerLab OS" current="v2.4.1" available="v2.5.0" type="system" />
      <UpdateRow name="Plex Media Server" current="1.40.2" available="1.41.0" type="app" />

      <div className="flex items-center gap-2 mt-2">
        <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer">
          Update All
        </button>
        <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5">
          <RefreshCw className="size-3" />
          Check for Updates
        </button>
      </div>

      <SectionDivider title="Update Preferences" />
      <Toggle label="Auto-check for updates" description="Check for new updates daily" enabled={autoCheck} onToggle={() => setAutoCheck(!autoCheck)} />
      <SettingsSelect label="Update channel" value="Stable" options={["Stable", "Beta", "Nightly"]} description="Choose which release channel to follow" />
      <SettingsSelect label="Auto-update policy" value="Security Only" options={["Disabled", "Security Only", "All Updates"]} description="Which updates to install automatically" />

      <SectionDivider title="Update History" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden">
        {[
          { name: "Grafana", from: "10.4.1", to: "11.0.0", date: "Feb 18, 2026" },
          { name: "Pi-hole", from: "5.17", to: "5.18.2", date: "Feb 15, 2026" },
          { name: "Nextcloud", from: "27.1", to: "28.0", date: "Feb 10, 2026" },
          { name: "ServerLab OS", from: "v2.3.8", to: "v2.4.1", date: "Feb 5, 2026" },
          { name: "Docker Engine", from: "25.0", to: "26.1.4", date: "Jan 28, 2026" },
        ].map((entry, i, arr) => (
          <div key={i} className={`flex items-center justify-between px-3 py-2 text-xs ${i < arr.length - 1 ? "border-b border-glass-border" : ""}`}>
            <span className="text-foreground w-32">{entry.name}</span>
            <span className="text-muted-foreground font-mono">{entry.from} <ChevronRight className="size-3 inline" /> {entry.to}</span>
            <span className="text-muted-foreground">{entry.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AppearanceSection() {
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Theme" />
      <div className="flex items-center gap-3 py-2">
        {[
          { name: "Dark", color: "oklch(0.13 0.015 250)", active: true },
          { name: "Light", color: "oklch(0.97 0.005 250)", active: false },
          { name: "System", color: "linear-gradient(135deg, oklch(0.13 0.015 250) 50%, oklch(0.97 0.005 250) 50%)", active: false },
        ].map((theme) => (
          <button
            key={theme.name}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
              theme.active
                ? "border-primary bg-primary/10"
                : "border-glass-border bg-secondary/20 hover:bg-secondary/40"
            }`}
          >
            <div
              className="w-16 h-10 rounded-lg border border-glass-border"
              style={{ background: theme.color }}
            />
            <span className={`text-[11px] ${theme.active ? "text-primary font-medium" : "text-muted-foreground"}`}>
              {theme.name}
            </span>
          </button>
        ))}
      </div>

      <SectionDivider title="Accent Color" />
      <div className="flex items-center gap-2 py-2">
        {[
          { name: "Teal", value: "oklch(0.72 0.14 190)", active: true },
          { name: "Blue", value: "oklch(0.65 0.2 250)" },
          { name: "Green", value: "oklch(0.72 0.18 155)" },
          { name: "Amber", value: "oklch(0.78 0.15 80)" },
          { name: "Rose", value: "oklch(0.65 0.2 10)" },
          { name: "Violet", value: "oklch(0.6 0.2 300)" },
        ].map((color) => (
          <button
            key={color.name}
            className={`size-8 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
              color.active ? "border-foreground scale-110" : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          >
            {color.active && <Check className="size-3.5 text-primary-foreground" />}
          </button>
        ))}
      </div>

      <SectionDivider title="Wallpaper" />
      <div className="flex items-center gap-2 py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            className={`w-20 h-12 rounded-lg border-2 transition-all cursor-pointer overflow-hidden ${
              i === 0 ? "border-primary" : "border-glass-border hover:border-foreground/30"
            }`}
          >
            <div
              className="w-full h-full"
              style={
                i === 0
                  ? { backgroundImage: "url('/images/wallpaper.jpg')", backgroundSize: "cover" }
                  : { background: `oklch(${0.15 + i * 0.05} ${0.01 + i * 0.015} ${180 + i * 30})` }
              }
            />
          </button>
        ))}
      </div>

      <SectionDivider title="Display" />
      <SettingsSelect label="Icon size" value="Medium" options={["Small", "Medium", "Large"]} />
      <SettingsSelect label="Font size" value="Default" options={["Compact", "Default", "Large", "Extra Large"]} />
      <Toggle label="Animations" description="Enable smooth transitions and hover effects" enabled={animationsEnabled} onToggle={() => setAnimationsEnabled(!animationsEnabled)} />
      <SettingsSelect label="Dock position" value="Bottom" options={["Bottom", "Left", "Right"]} />
    </div>
  )
}

function PowerSection() {
  const [scheduledReboot, setScheduledReboot] = useState(false)
  const [uptimeAlerts, setUptimeAlerts] = useState(true)

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Power Management" />
      <InfoBanner text="These actions will affect all running services. Make sure to save your work before proceeding." variant="warning" />

      <div className="grid grid-cols-3 gap-3 py-3">
        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-glass-border bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer group">
          <RefreshCw className="size-5 text-status-amber group-hover:animate-spin" />
          <span className="text-xs text-foreground">Reboot</span>
        </button>
        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-glass-border bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer group">
          <Power className="size-5 text-status-red" />
          <span className="text-xs text-foreground">Shutdown</span>
        </button>
        <button className="flex flex-col items-center gap-2 p-4 rounded-xl border border-glass-border bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer group">
          <Zap className="size-5 text-primary" />
          <span className="text-xs text-foreground">Sleep</span>
        </button>
      </div>

      <SectionDivider title="Schedule" />
      <Toggle label="Scheduled reboot" description="Automatically reboot the server on a set schedule" enabled={scheduledReboot} onToggle={() => setScheduledReboot(!scheduledReboot)} />
      {scheduledReboot && (
        <>
          <SettingsSelect label="Day" value="Sunday" options={["Daily", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]} />
          <SettingsSelect label="Time" value="04:00 AM" options={["12:00 AM", "01:00 AM", "02:00 AM", "03:00 AM", "04:00 AM", "05:00 AM", "06:00 AM"]} />
        </>
      )}

      <SectionDivider title="UPS" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-status-green" />
            <span className="text-sm text-foreground font-medium">APC Back-UPS 1500VA</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">Online</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">Battery</span>
            <span className="text-foreground">98%</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Load</span>
            <span className="text-foreground">340W / 900W</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Runtime</span>
            <span className="text-foreground">~45 min</span>
          </div>
        </div>
      </div>
      <SettingsSelect label="On battery action" value="Shutdown after 10 min" options={["Shutdown after 5 min", "Shutdown after 10 min", "Shutdown after 30 min", "Hibernate", "Do nothing"]} description="Action to take when power is lost" />

      <SectionDivider title="Monitoring" />
      <Toggle label="Uptime alerts" description="Get notified if server goes offline unexpectedly" enabled={uptimeAlerts} onToggle={() => setUptimeAlerts(!uptimeAlerts)} />

      <SectionDivider title="Factory Reset" />
      <InfoBanner text="Factory reset will erase all settings and restore the server to its default configuration. Your files and media will not be affected." variant="warning" />
      <button className="self-start mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors cursor-pointer">
        Factory Reset Server
      </button>
    </div>
  )
}

// =====================
// Section Renderer
// =====================

function renderSection(id: string) {
  switch (id) {
    case "general":
      return <GeneralSection />
    case "network":
      return <NetworkSection />
    case "storage":
      return <StorageSection />
    case "docker":
      return <DockerSection />
    case "users":
      return <UsersSection />
    case "security":
      return <SecuritySection />
    case "notifications":
      return <NotificationsSection />
    case "backup":
      return <BackupSection />
    case "updates":
      return <UpdatesSection />
    case "appearance":
      return <AppearanceSection />
    case "power":
      return <PowerSection />
    default:
      return null
  }
}

// =====================
// Main Settings Component
// =====================

export function SettingsPanel() {
  const [activeSection, setActiveSection] = useState("general")

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <aside className="w-52 shrink-0 border-r border-glass-border bg-[oklch(0.11_0.01_250/0.5)] flex flex-col overflow-y-auto">
        <div className="p-3 pt-4">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
            Settings
          </span>
          <div className="flex flex-col gap-0.5 mt-2">
            {sections.map((section) => {
              const isActive = activeSection === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/15 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <section.icon className={`size-4 ${isActive ? "text-primary" : ""}`} />
                  <span className="flex-1 text-left truncate">{section.label}</span>
                  {section.badge && (
                    <span className="size-4.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                      {section.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Server info footer */}
        <div className="mt-auto p-3 border-t border-glass-border">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-status-green" />
            <span className="text-[10px] text-muted-foreground">serverlab-node01</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1 block">v2.4.1 | Ubuntu 24.04</span>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {sections.find((s) => s.id === activeSection)?.label}
            </h2>
            <button className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
              Save Changes
            </button>
          </div>
          {renderSection(activeSection)}
        </div>
      </main>
    </div>
  )
}
