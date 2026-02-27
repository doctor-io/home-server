"use client";

import type {
  AccentColorOption,
  AppearanceSettings,
  DockPosition,
  WallpaperOption,
} from "@/lib/desktop/appearance";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  Container,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  Globe,
  HardDrive,
  Info,
  Lock,
  Mail,
  MemoryStick,
  MonitorSpeaker,
  Palette,
  Power,
  RefreshCw,
  Server,
  Shield,
  Thermometer,
  ToggleLeft,
  ToggleRight,
  Upload,
  Users,
  Wifi,
  Zap
} from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ChangeEvent,
} from "react";
import { useSettingsBackend } from "@/hooks/useSettingsBackend";

// =====================
// Types
// =====================

type SettingsSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

type ControlAvailability = {
  disabled?: boolean;
  disabledReason?: string;
};

const ControlAvailabilityContext = createContext<ControlAvailability>({
  disabled: false,
});

function useControlAvailability(
  overrideDisabled?: boolean,
  overrideReason?: string,
) {
  const context = useContext(ControlAvailabilityContext);
  const disabled =
    overrideDisabled !== undefined ? overrideDisabled : Boolean(context.disabled);

  const disabledReason =
    overrideReason !== undefined
      ? overrideReason
      : disabled
        ? context.disabledReason
        : undefined;

  return {
    disabled,
    disabledReason,
  };
}

function ControlDisabledHint({ text }: { text?: string }) {
  if (!text) return null;
  return <span className="text-xs text-status-amber">{text}</span>;
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
  { id: "updates", label: "Updates", icon: RefreshCw },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "power", label: "Power", icon: Power },
];

// =====================
// Toggle component
// =====================

function Toggle({
  enabled,
  onToggle,
  label,
  description,
  disabled,
  disabledReason,
}: {
  enabled: boolean;
  onToggle: () => void;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const availability = useControlAvailability(disabled, disabledReason);

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-foreground">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
        <ControlDisabledHint text={availability.disabledReason} />
      </div>
      <button
        onClick={availability.disabled ? undefined : onToggle}
        className={`shrink-0 ${
          availability.disabled
            ? "cursor-not-allowed opacity-50"
            : "cursor-pointer"
        }`}
        aria-label={`Toggle ${label}`}
        disabled={availability.disabled}
      >
        {enabled ? (
          <ToggleRight className="size-7 text-primary" />
        ) : (
          <ToggleLeft className="size-7 text-muted-foreground" />
        )}
      </button>
    </div>
  );
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
  disabled,
  disabledReason,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  copyable?: boolean;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const isPassword = type === "password";
  const availability = useControlAvailability(disabled, disabledReason);
  const inputValueProps =
    readOnly || availability.disabled
      ? { value }
      : { defaultValue: value };

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {description && (
        <span className="text-xs text-muted-foreground/70">{description}</span>
      )}
      <ControlDisabledHint text={availability.disabledReason} />
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type={isPassword && !showPassword ? "password" : "text"}
            {...inputValueProps}
            placeholder={placeholder}
            readOnly={readOnly || availability.disabled}
            disabled={availability.disabled}
            className="h-8 w-full rounded-lg bg-secondary/40 border border-glass-border px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40 transition-all read-only:opacity-60 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isPassword && (
            <button
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground ${
                availability.disabled
                  ? "cursor-not-allowed opacity-50"
                  : "cursor-pointer hover:text-foreground"
              }`}
              disabled={availability.disabled}
            >
              {showPassword ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          )}
        </div>
        {copyable && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`p-1.5 rounded-lg text-muted-foreground transition-colors ${
              availability.disabled
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-secondary/50 hover:text-foreground"
            }`}
            disabled={availability.disabled}
          >
            {copied ? (
              <Check className="size-3.5 text-status-green" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// =====================
// Select Field
// =====================

function SettingsSelect({
  label,
  value,
  options,
  description,
  onChange,
  disabled,
  disabledReason,
}: {
  label: string;
  value: string;
  options: string[];
  description?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const availability = useControlAvailability(disabled, disabledReason);

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {description && (
        <span className="text-xs text-muted-foreground/70">{description}</span>
      )}
      <ControlDisabledHint text={availability.disabledReason} />
      <select
        {...(onChange
          ? {
              value,
              onChange: (e: ChangeEvent<HTMLSelectElement>) =>
                onChange(e.target.value),
            }
          : { value })}
        disabled={availability.disabled}
        onChange={(event) => {
          if (!onChange) return;
          onChange(event.target.value);
        }}
        className="h-8 rounded-lg bg-secondary/40 border border-glass-border px-3 text-xs text-foreground focus:outline-none focus:border-primary/40 transition-all cursor-pointer appearance-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// =====================
// Section Divider
// =====================

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 pt-5 pb-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        {title}
      </span>
      <div className="flex-1 h-px bg-glass-border" />
    </div>
  );
}

// =====================
// Info Banner
// =====================

function InfoBanner({
  text,
  variant = "info",
}: {
  text: string;
  variant?: "info" | "warning";
}) {
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
  );
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
  label: string;
  used: number;
  total: number;
  unit: string;
  color: string;
}) {
  const pct = Math.round((used / total) * 100);
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
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
  );
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
  name: string;
  role: string;
  email: string;
  lastActive: string;
  avatarColor: string;
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
            className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
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
        <span className="text-xs text-muted-foreground">{email}</span>
      </div>
      <span className="text-xs text-muted-foreground hidden sm:block">
        {lastActive}
      </span>
      <button className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-secondary/50 transition-all text-muted-foreground cursor-pointer">
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
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
  actionsDisabled,
  disabledReason,
}: {
  name: string;
  image: string;
  status: "running" | "stopped" | "restarting";
  ports: string;
  cpu: string;
  memory: string;
  actionsDisabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3 group">
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
            <span className="text-xs text-muted-foreground font-mono">
              {image}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {ports} | CPU: {cpu} | RAM: {memory}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button
            className="px-2 py-1 text-xs rounded-md bg-secondary/50 text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-secondary enabled:hover:text-foreground cursor-pointer"
            disabled={actionsDisabled}
          >
            {status === "running" ? "Stop" : "Start"}
          </button>
          <button
            className="px-2 py-1 text-xs rounded-md bg-secondary/50 text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-secondary enabled:hover:text-foreground cursor-pointer"
            disabled={actionsDisabled}
          >
            Restart
          </button>
        </div>
      </div>
      {actionsDisabled && (
        <span className="text-xs text-status-amber">{disabledReason}</span>
      )}
    </div>
  );
}

// =====================
// Update Row
// =====================

function UpdateRow({
  name,
  current,
  available,
  type,
  actionDisabled,
  disabledReason,
}: {
  name: string;
  current: string;
  available: string;
  type: "system" | "app";
  actionDisabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center gap-3 group">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {type === "system" ? (
            <Cpu className="size-4 text-primary" />
          ) : (
            <Container className="size-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-foreground">{name}</span>
          <div className="text-xs text-muted-foreground">
            {current} <ChevronRight className="size-3 inline" /> {available}
          </div>
        </div>
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-primary/25 cursor-pointer"
          disabled={actionDisabled}
        >
          Update
        </button>
      </div>
      {actionDisabled && (
        <span className="text-xs text-status-amber">{disabledReason}</span>
      )}
    </div>
  );
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
  date: string;
  size: string;
  type: string;
  status: "completed" | "failed" | "in-progress";
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
        <div className="text-xs text-muted-foreground">
          {date} - {size}
        </div>
      </div>
      <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
        <Download className="size-3.5" />
      </button>
    </div>
  );
}

// =====================
// Section Content
// =====================

function GeneralSection({
  data,
  capabilities,
}: {
  data: ReturnType<typeof useSettingsBackend>["general"];
  capabilities: ReturnType<typeof useSettingsBackend>["capabilities"]["general"];
}) {
  return (
    <div className="flex flex-col gap-1">
      {data.warning && (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      )}
      <SectionDivider title="System Info" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Hostname</span>
          <span className="text-sm text-foreground font-medium">
            {data.hostname}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">OS</span>
          <span className="text-sm text-foreground">{data.platform}</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Kernel</span>
          <span className="text-sm text-foreground font-mono text-xs">
            {data.kernel}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Architecture</span>
          <span className="text-sm text-foreground">{data.architecture}</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">Uptime</span>
          <span className="text-sm text-foreground">{data.uptime}</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1.5">
          <span className="text-xs text-muted-foreground">
            ServerLab Version
          </span>
          <span className="text-sm text-foreground">{data.appVersion}</span>
        </div>
      </div>

      <SectionDivider title="Hardware" />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex items-center gap-2 py-1.5">
          <Cpu className="size-4 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground block">
              Processor
            </span>
            <span className="text-xs text-foreground">{data.cpuSummary}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <MemoryStick className="size-4 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground block">Memory</span>
            <span className="text-xs text-foreground">{data.memorySummary}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <Thermometer className="size-4 text-status-amber" />
          <div>
            <span className="text-xs text-muted-foreground block">
              CPU Temperature
            </span>
            <span className="text-xs text-foreground">
              {data.temperatureSummary}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 py-1.5">
          <MonitorSpeaker className="size-4 text-primary" />
          <div>
            <span className="text-xs text-muted-foreground block">User</span>
            <span className="text-xs text-foreground">
              {data.username} ({data.processUptime})
            </span>
          </div>
        </div>
      </div>

      <SectionDivider title="Preferences" />
      <SettingsInput
        label="Hostname"
        value={data.hostname}
        disabled={capabilities.hostname.disabled}
        disabledReason={capabilities.hostname.disabledReason}
      />
      <SettingsSelect
        label="Timezone"
        value="UTC"
        options={[
          "UTC",
          "America/New_York",
          "America/Los_Angeles",
          "Europe/London",
          "Europe/Berlin",
          "Asia/Tokyo",
          "Asia/Shanghai",
        ]}
        disabled={capabilities.timezone.disabled}
        disabledReason={capabilities.timezone.disabledReason}
      />
      <SettingsSelect
        label="Language"
        value="English (US)"
        options={[
          "English (US)",
          "English (UK)",
          "Deutsch",
          "Francais",
          "Espanol",
          "Portugues",
        ]}
        disabled={capabilities.language.disabled}
        disabledReason={capabilities.language.disabledReason}
      />
      <Toggle
        label="Auto-start services on boot"
        description="Automatically start all enabled services when the server boots"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.autoStart.disabled}
        disabledReason={capabilities.autoStart.disabledReason}
      />
      <Toggle
        label="Remote access"
        description="Allow remote connections via SSH and web UI"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.remoteAccess.disabled}
        disabledReason={capabilities.remoteAccess.disabledReason}
      />
      <Toggle
        label="Anonymous telemetry"
        description="Send anonymized usage data to help improve ServerLab"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.telemetry.disabled}
        disabledReason={capabilities.telemetry.disabledReason}
      />
    </div>
  );
}

function NetworkSection({
  data,
  capabilities,
}: {
  data: ReturnType<typeof useSettingsBackend>["network"];
  capabilities: ReturnType<typeof useSettingsBackend>["capabilities"]["network"];
}) {
  return (
    <div className="flex flex-col gap-1">
      {data.warning && (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      )}
      <SectionDivider title="Interfaces" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-glass-border">
          <div className="flex items-center gap-3">
            <div
              className={`size-2 rounded-full ${
                data.connected ? "bg-status-green" : "bg-muted-foreground/50"
              }`}
            />
            <div>
              <span className="text-sm text-foreground font-medium">
                {data.iface}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                {data.connected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Signal {data.signalPercent}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 p-3">
          <div>
            <span className="text-xs text-muted-foreground block">
              IPv4 Address
            </span>
            <span className="text-xs text-foreground font-mono">
              {data.ipv4}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              SSID
            </span>
            <span className="text-xs text-foreground font-mono">
              {data.ssid}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Wi-Fi Networks
            </span>
            <span className="text-xs text-foreground font-mono">
              {data.wifiCount}
            </span>
          </div>
        </div>
        {data.topSsids.length > 0 && (
          <div className="px-3 pb-3 text-xs text-muted-foreground">
            Nearby: {data.topSsids.join(", ")}
          </div>
        )}
      </div>

      <SectionDivider title="Configuration" />
      <SettingsInput
        label="Gateway"
        value="--"
        disabled={capabilities.gateway.disabled}
        disabledReason={capabilities.gateway.disabledReason}
      />
      <SettingsInput
        label="DNS Primary"
        value="--"
        disabled={capabilities.dnsPrimary.disabled}
        disabledReason={capabilities.dnsPrimary.disabledReason}
      />
      <SettingsInput
        label="DNS Secondary"
        value="--"
        disabled={capabilities.dnsSecondary.disabled}
        disabledReason={capabilities.dnsSecondary.disabledReason}
      />
      <SettingsInput
        label="Domain"
        value="--"
        disabled={capabilities.domain.disabled}
        disabledReason={capabilities.domain.disabledReason}
      />
      <Toggle
        label="DHCP"
        description="Automatically obtain IP address from network"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.dhcp.disabled}
        disabledReason={capabilities.dhcp.disabledReason}
      />
      <Toggle
        label="IPv6"
        description="Enable IPv6 networking support"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.ipv6.disabled}
        disabledReason={capabilities.ipv6.disabledReason}
      />

      <SectionDivider title="Advanced" />
      <Toggle
        label="Wake-on-LAN"
        description="Allow remote wake up via network packet"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.wol.disabled}
        disabledReason={capabilities.wol.disabledReason}
      />
      <SettingsSelect
        label="MTU"
        value="1500"
        options={["1500", "9000", "Custom"]}
        description="Maximum Transmission Unit size"
        disabled={capabilities.mtu.disabled}
        disabledReason={capabilities.mtu.disabledReason}
      />

      <SectionDivider title="Port Forwarding" />
      <InfoBanner text="Port forwarding rules let external traffic reach services on this server. Make sure to configure your router accordingly." />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden mt-2">
        {[
          { ext: "80", int: "80", proto: "TCP", service: "Nginx" },
          { ext: "443", int: "443", proto: "TCP", service: "Nginx (SSL)" },
          { ext: "32400", int: "32400", proto: "TCP", service: "Plex" },
          { ext: "51820", int: "51820", proto: "UDP", service: "WireGuard" },
        ].map((rule, i, arr) => (
          <div
            key={i}
            className={`flex items-center justify-between px-3 py-2 text-xs ${i < arr.length - 1 ? "border-b border-glass-border" : ""}`}
          >
            <span className="text-foreground w-20">{rule.service}</span>
            <span className="text-muted-foreground font-mono">
              {rule.ext} <ChevronRight className="size-3 inline" /> {rule.int}
            </span>
            <span className="text-muted-foreground">{rule.proto}</span>
          </div>
        ))}
      </div>
      <button
        className="mt-2 self-start px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary"
        disabled={capabilities.addRule.disabled}
        title={capabilities.addRule.disabledReason}
      >
        + Add Rule
      </button>
      <ControlDisabledHint text={capabilities.addRule.disabledReason} />
    </div>
  );
}

function StorageSection() {
  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Disks" />
      <StorageBar
        label="/dev/sda1 - System (NVMe SSD)"
        used={120}
        total={500}
        unit="GB"
        color="oklch(0.72 0.14 190)"
      />
      <StorageBar
        label="/dev/sdb1 - Data Pool 1 (HDD)"
        used={1800}
        total={4000}
        unit="GB"
        color="oklch(0.65 0.15 160)"
      />
      <StorageBar
        label="/dev/sdc1 - Data Pool 2 (HDD)"
        used={2100}
        total={4000}
        unit="GB"
        color="oklch(0.78 0.12 85)"
      />
      <StorageBar
        label="/dev/sdd1 - Backup (HDD)"
        used={840}
        total={2000}
        unit="GB"
        color="oklch(0.6 0.2 340)"
      />

      <SectionDivider title="RAID Configuration" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-foreground font-medium">
            ZFS Pool: datapool
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">
            Healthy
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-xs text-muted-foreground block">
              Type
            </span>
            <span className="text-foreground">RAID-Z1 (raidz)</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Total Size
            </span>
            <span className="text-foreground">8 TB</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Redundancy
            </span>
            <span className="text-foreground">1 disk parity</span>
          </div>
        </div>
      </div>

      <SectionDivider title="Shared Folders" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden">
        {[
          {
            name: "Media",
            path: "/srv/media",
            protocol: "SMB / NFS",
            size: "3.2 TB",
          },
          {
            name: "Documents",
            path: "/srv/documents",
            protocol: "SMB",
            size: "48 GB",
          },
          {
            name: "Backups",
            path: "/srv/backups",
            protocol: "NFS",
            size: "840 GB",
          },
          {
            name: "Public",
            path: "/srv/public",
            protocol: "SMB",
            size: "12 GB",
          },
        ].map((share, i, arr) => (
          <div
            key={i}
            className={`flex items-center justify-between px-3 py-2.5 text-xs ${i < arr.length - 1 ? "border-b border-glass-border" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <HardDrive className="size-3.5 text-primary" />
              <div>
                <span className="text-foreground font-medium">
                  {share.name}
                </span>
                <span className="text-muted-foreground font-mono ml-2">
                  {share.path}
                </span>
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
  );
}

function DockerSection({
  data,
  capabilities,
}: {
  data: ReturnType<typeof useSettingsBackend>["docker"];
  capabilities: ReturnType<typeof useSettingsBackend>["capabilities"]["docker"];
}) {
  return (
    <div className="flex flex-col gap-1">
      {data.warning && (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      )}
      <SectionDivider title="Engine Status" />
      <div className="grid grid-cols-3 gap-4 py-2">
        <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 text-center">
          <span className="text-xl font-bold text-foreground">{data.total}</span>
          <span className="text-xs text-muted-foreground block mt-0.5">
            Containers
          </span>
        </div>
        <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 text-center">
          <span className="text-xl font-bold text-status-green">{data.running}</span>
          <span className="text-xs text-muted-foreground block mt-0.5">
            Running
          </span>
        </div>
        <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 text-center">
          <span className="text-xl font-bold text-foreground">{data.images}</span>
          <span className="text-xs text-muted-foreground block mt-0.5">
            Images
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2">
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-xs text-muted-foreground">Docker Version</span>
          <span className="text-xs text-foreground font-mono">
            {data.engineVersion}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-xs text-muted-foreground">Compose Version</span>
          <span className="text-xs text-foreground font-mono">
            {data.composeVersion}
          </span>
        </div>
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-xs text-muted-foreground">Storage Driver</span>
          <span className="text-xs text-foreground">{data.storageDriver}</span>
        </div>
        <div className="flex flex-col gap-0.5 py-1">
          <span className="text-xs text-muted-foreground">Cgroup Driver</span>
          <span className="text-xs text-foreground">{data.cgroupDriver}</span>
        </div>
      </div>

      <SectionDivider title="Containers" />
      {data.containers.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground">
          No containers reported.
        </div>
      ) : (
        data.containers.map((container) => (
          <ContainerRow
            key={container.id}
            name={container.name}
            image={container.image}
            status={container.status}
            ports={container.ports}
            cpu={container.cpu}
            memory={container.memory}
            actionsDisabled={capabilities.lifecycle.disabled}
            disabledReason={capabilities.lifecycle.disabledReason}
          />
        ))
      )}

      <SectionDivider title="Settings" />
      <SettingsInput label="Data Root" value="--" readOnly />
      <Toggle
        label="Auto-restart policy"
        description="Automatically restart crashed containers"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.autoRestart.disabled}
        disabledReason={capabilities.autoRestart.disabledReason}
      />
      <Toggle
        label="Log rotation"
        description="Rotate container logs to prevent disk overuse"
        enabled={false}
        onToggle={() => {}}
        disabled={capabilities.logRotation.disabled}
        disabledReason={capabilities.logRotation.disabledReason}
      />
      <SettingsSelect
        label="Default Network"
        value="bridge"
        options={["bridge", "host", "macvlan", "none"]}
        disabled={capabilities.defaultNetwork.disabled}
        disabledReason={capabilities.defaultNetwork.disabledReason}
      />

      <div className="flex items-center gap-2 mt-3">
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary"
          disabled={capabilities.pruneImages.disabled}
          title={capabilities.pruneImages.disabledReason}
        >
          Prune Unused Images
        </button>
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary"
          disabled={capabilities.pruneVolumes.disabled}
          title={capabilities.pruneVolumes.disabledReason}
        >
          Prune Volumes
        </button>
      </div>
      <ControlDisabledHint text={capabilities.pruneImages.disabledReason} />
    </div>
  );
}

function UsersSection() {
  const [twoFactor, setTwoFactor] = useState(true);
  const [sshKeys, setSshKeys] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="User Accounts" />
      <UserRow
        name="admin"
        role="Admin"
        email="admin@serverlab.local"
        lastActive="Just now"
        avatarColor="oklch(0.55 0.15 190)"
      />
      <UserRow
        name="sarah"
        role="Editor"
        email="sarah@home.lan"
        lastActive="2 hours ago"
        avatarColor="oklch(0.6 0.15 340)"
      />
      <UserRow
        name="media-user"
        role="Viewer"
        email="media@home.lan"
        lastActive="1 day ago"
        avatarColor="oklch(0.65 0.12 85)"
      />
      <UserRow
        name="backup-bot"
        role="Service"
        email="backup@serverlab.local"
        lastActive="12 min ago"
        avatarColor="oklch(0.5 0.1 250)"
      />
      <button className="self-start mt-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer">
        + Add User
      </button>

      <SectionDivider title="Authentication" />
      <Toggle
        label="Require two-factor authentication"
        description="Enforce 2FA for all admin accounts"
        enabled={twoFactor}
        onToggle={() => setTwoFactor(!twoFactor)}
      />
      <SettingsSelect
        label="Session timeout"
        value="30 minutes"
        options={["15 minutes", "30 minutes", "1 hour", "4 hours", "Never"]}
        description="Auto-logout after period of inactivity"
      />
      <Toggle
        label="SSH key authentication"
        description="Require SSH keys instead of password for remote login"
        enabled={sshKeys}
        onToggle={() => setSshKeys(!sshKeys)}
      />

      <SectionDivider title="API Keys" />
      <InfoBanner text="API keys allow external services and scripts to interact with your server programmatically." />
      <SettingsInput
        label="Primary API Key"
        value="sk_live_serverlab_a8B2k9Xm4pQ7rY..."
        type="password"
        copyable
      />
      <button className="self-start mt-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
        Regenerate Key
      </button>
    </div>
  );
}

function SecuritySection() {
  const [firewall, setFirewall] = useState(true);
  const [failBan, setFailBan] = useState(true);
  const [autoUpdates, setAutoUpdates] = useState(true);
  const [auditLog, setAuditLog] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Firewall" />
      <Toggle
        label="UFW Firewall"
        description="Uncomplicated Firewall for managing inbound/outbound rules"
        enabled={firewall}
        onToggle={() => setFirewall(!firewall)}
      />
      <SettingsSelect
        label="Default incoming policy"
        value="Deny"
        options={["Deny", "Allow", "Reject"]}
      />
      <SettingsSelect
        label="Default outgoing policy"
        value="Allow"
        options={["Allow", "Deny", "Reject"]}
      />

      <SectionDivider title="Intrusion Prevention" />
      <Toggle
        label="Fail2Ban"
        description="Automatically ban IPs with repeated failed login attempts"
        enabled={failBan}
        onToggle={() => setFailBan(!failBan)}
      />
      <SettingsInput
        label="Max retries"
        value="5"
        description="Number of failed attempts before banning"
      />
      <SettingsInput
        label="Ban duration"
        value="3600"
        description="Ban time in seconds (3600 = 1 hour)"
      />

      <SectionDivider title="SSL / TLS" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-status-green" />
            <span className="text-sm text-foreground font-medium">
              Let&apos;s Encrypt
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">
            Valid
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-xs text-muted-foreground block">
              Domain
            </span>
            <span className="text-foreground">*.serverlab.local</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Expires
            </span>
            <span className="text-foreground">Apr 22, 2026</span>
          </div>
        </div>
      </div>
      <button className="self-start mt-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
        Renew Certificate
      </button>

      <SectionDivider title="VPN" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <span className="text-sm text-foreground font-medium">
              WireGuard
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">
            Active
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-xs text-muted-foreground block">
              Port
            </span>
            <span className="text-foreground font-mono">51820</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Peers
            </span>
            <span className="text-foreground">3 connected</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Tunnel IP
            </span>
            <span className="text-foreground font-mono">10.0.0.1/24</span>
          </div>
        </div>
      </div>

      <SectionDivider title="Audit & Logging" />
      <Toggle
        label="Security auto-updates"
        description="Automatically install critical security patches"
        enabled={autoUpdates}
        onToggle={() => setAutoUpdates(!autoUpdates)}
      />
      <Toggle
        label="Audit logging"
        description="Record all system access and configuration changes"
        enabled={auditLog}
        onToggle={() => setAuditLog(!auditLog)}
      />
    </div>
  );
}

function NotificationsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [discordNotifs, setDiscordNotifs] = useState(true);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [updateNotifs, setUpdateNotifs] = useState(true);
  const [backupNotifs, setBackupNotifs] = useState(true);
  const [securityNotifs, setSecurityNotifs] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Channels" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center gap-2.5 mb-2">
          <Mail className="size-4 text-primary" />
          <span className="text-sm text-foreground font-medium">
            Email (SMTP)
          </span>
        </div>
        <SettingsInput label="SMTP Server" value="smtp.gmail.com" />
        <SettingsInput label="Port" value="587" />
        <SettingsInput label="Username" value="serverlab.alerts@gmail.com" />
        <SettingsInput
          label="Password"
          value="app-specific-password"
          type="password"
        />
        <SettingsInput label="Recipient" value="admin@home.lan" />
        <Toggle
          label="Enable email notifications"
          enabled={emailNotifs}
          onToggle={() => setEmailNotifs(!emailNotifs)}
        />
      </div>

      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3 mt-2">
        <div className="flex items-center gap-2.5 mb-2">
          <Globe className="size-4 text-[#5865F2]" />
          <span className="text-sm text-foreground font-medium">
            Discord Webhook
          </span>
        </div>
        <SettingsInput
          label="Webhook URL"
          value="https://discord.com/api/webhooks/1234..."
          type="password"
        />
        <Toggle
          label="Enable Discord notifications"
          enabled={discordNotifs}
          onToggle={() => setDiscordNotifs(!discordNotifs)}
        />
      </div>

      <SectionDivider title="Alert Types" />
      <Toggle
        label="System alerts"
        description="CPU overload, high temperature, low disk space"
        enabled={systemAlerts}
        onToggle={() => setSystemAlerts(!systemAlerts)}
      />
      <Toggle
        label="Update notifications"
        description="New versions available for apps and system"
        enabled={updateNotifs}
        onToggle={() => setUpdateNotifs(!updateNotifs)}
      />
      <Toggle
        label="Backup reports"
        description="Backup success/failure notifications"
        enabled={backupNotifs}
        onToggle={() => setBackupNotifs(!backupNotifs)}
      />
      <Toggle
        label="Security events"
        description="Failed logins, firewall blocks, certificate expiry"
        enabled={securityNotifs}
        onToggle={() => setSecurityNotifs(!securityNotifs)}
      />

      <SectionDivider title="Thresholds" />
      <SettingsInput
        label="CPU usage alert threshold"
        value="90"
        description="Trigger alert when CPU usage exceeds this %"
      />
      <SettingsInput
        label="Memory alert threshold"
        value="85"
        description="Trigger alert when RAM usage exceeds this %"
      />
      <SettingsInput
        label="Disk space alert threshold"
        value="90"
        description="Trigger alert when disk usage exceeds this %"
      />
      <SettingsInput
        label="Temperature alert threshold"
        value="80"
        description="Trigger alert when CPU temp exceeds this (Celsius)"
      />
    </div>
  );
}

function BackupSection() {
  const [autoBackup, setAutoBackup] = useState(true);
  const [encryptBackups, setEncryptBackups] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Backup Schedule" />
      <Toggle
        label="Automatic backups"
        description="Run scheduled backups automatically"
        enabled={autoBackup}
        onToggle={() => setAutoBackup(!autoBackup)}
      />
      <SettingsSelect
        label="Frequency"
        value="Daily"
        options={["Hourly", "Daily", "Weekly", "Monthly"]}
      />
      <SettingsSelect
        label="Time"
        value="03:00 AM"
        options={[
          "12:00 AM",
          "01:00 AM",
          "02:00 AM",
          "03:00 AM",
          "04:00 AM",
          "05:00 AM",
          "06:00 AM",
        ]}
      />
      <SettingsInput
        label="Retention"
        value="30"
        description="Number of backups to keep before rotating"
      />

      <SectionDivider title="Backup Target" />
      <SettingsSelect
        label="Destination"
        value="Local + Remote"
        options={["Local Only", "Remote Only", "Local + Remote"]}
      />
      <SettingsInput label="Local path" value="/srv/backups" readOnly />
      <SettingsInput
        label="Remote (S3-compatible)"
        value="s3://my-bucket/serverlab-backups/"
      />
      <SettingsInput
        label="Access Key"
        value="AKIAIOSFODNN7EXAMPLE"
        type="password"
        copyable
      />
      <SettingsInput
        label="Secret Key"
        value="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        type="password"
      />

      <SectionDivider title="Encryption" />
      <Toggle
        label="Encrypt backups"
        description="AES-256 encryption for all backup archives"
        enabled={encryptBackups}
        onToggle={() => setEncryptBackups(!encryptBackups)}
      />
      <SettingsInput
        label="Encryption passphrase"
        value="super-secret-backup-key"
        type="password"
        copyable
      />

      <SectionDivider title="What to Back Up" />
      {[
        {
          name: "Application data",
          desc: "Docker volumes, app configs",
          size: "~12 GB",
          checked: true,
        },
        {
          name: "Database dumps",
          desc: "PostgreSQL, MariaDB, Redis",
          size: "~4.2 GB",
          checked: true,
        },
        {
          name: "System configuration",
          desc: "/etc, crontabs, SSH keys",
          size: "~120 MB",
          checked: true,
        },
        {
          name: "User media",
          desc: "Photos, documents, uploads",
          size: "~180 GB",
          checked: false,
        },
        {
          name: "Logs",
          desc: "Application and system logs",
          size: "~2.8 GB",
          checked: false,
        },
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
              <span className="text-xs text-muted-foreground block">
                {item.desc}
              </span>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{item.size}</span>
        </div>
      ))}

      <SectionDivider title="Recent Backups" />
      <BackupRow
        date="Feb 22, 2026 03:00 AM"
        size="14.8 GB"
        type="Full Backup"
        status="completed"
      />
      <BackupRow
        date="Feb 21, 2026 03:00 AM"
        size="14.6 GB"
        type="Full Backup"
        status="completed"
      />
      <BackupRow
        date="Feb 20, 2026 03:00 AM"
        size="14.5 GB"
        type="Full Backup"
        status="completed"
      />
      <BackupRow
        date="Feb 19, 2026 03:00 AM"
        size="14.2 GB"
        type="Full Backup"
        status="failed"
      />

      <div className="flex items-center gap-2 mt-3">
        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer flex items-center gap-1.5">
          <Upload className="size-3" />
          Run Backup Now
        </button>
        <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5">
          <Download className="size-3" />
          Restore from Backup
        </button>
      </div>
    </div>
  );
}

function UpdatesSection({
  data,
  capabilities,
  onCheckForUpdates,
}: {
  data: ReturnType<typeof useSettingsBackend>["updates"];
  capabilities: ReturnType<typeof useSettingsBackend>["capabilities"]["updates"];
  onCheckForUpdates: () => Promise<unknown>;
}) {
  const [autoCheck, setAutoCheck] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      {data.warning && (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      )}
      {data.checkError && <InfoBanner text={data.checkError} variant="warning" />}
      <SectionDivider title="Available Updates" />
      {data.entries.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground">
          No updates currently available.
        </div>
      ) : (
        data.entries.map((entry) => (
          <UpdateRow
            key={entry.id}
            name={entry.name}
            current={entry.current}
            available={entry.available}
            type={entry.type}
            actionDisabled={capabilities.updateRow.disabled}
            disabledReason={capabilities.updateRow.disabledReason}
          />
        ))
      )}

      <div className="flex items-center gap-2 mt-2">
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-primary/25"
          disabled={capabilities.updateAll.disabled}
          title={capabilities.updateAll.disabledReason}
        >
          Update All
        </button>
        <button
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary"
          disabled={capabilities.checkForUpdates.disabled || data.isChecking}
          onClick={() => {
            void onCheckForUpdates();
          }}
        >
          <RefreshCw className="size-3" />
          {data.isChecking ? "Checking..." : "Check for Updates"}
        </button>
      </div>
      <ControlDisabledHint text={capabilities.updateAll.disabledReason} />

      <SectionDivider title="Update Preferences" />
      <Toggle
        label="Auto-check for updates"
        description="Check for new updates daily"
        enabled={autoCheck}
        onToggle={() => setAutoCheck(!autoCheck)}
        disabled={capabilities.autoCheck.disabled}
        disabledReason={capabilities.autoCheck.disabledReason}
      />
      <SettingsSelect
        label="Update channel"
        value="Stable"
        options={["Stable", "Beta", "Nightly"]}
        description="Choose which release channel to follow"
        disabled={capabilities.channel.disabled}
        disabledReason={capabilities.channel.disabledReason}
      />
      <SettingsSelect
        label="Auto-update policy"
        value="Security Only"
        options={["Disabled", "Security Only", "All Updates"]}
        description="Which updates to install automatically"
        disabled={capabilities.autoUpdatePolicy.disabled}
        disabledReason={capabilities.autoUpdatePolicy.disabledReason}
      />

      <SectionDivider title="Update History" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 overflow-hidden">
        {[
          {
            name: "Grafana",
            from: "10.4.1",
            to: "11.0.0",
            date: "Feb 18, 2026",
          },
          { name: "Pi-hole", from: "5.17", to: "5.18.2", date: "Feb 15, 2026" },
          { name: "Nextcloud", from: "27.1", to: "28.0", date: "Feb 10, 2026" },
          {
            name: "ServerLab OS",
            from: "v2.3.8",
            to: "v2.4.1",
            date: "Feb 5, 2026",
          },
          {
            name: "Docker Engine",
            from: "25.0",
            to: "26.1.4",
            date: "Jan 28, 2026",
          },
        ].map((entry, i, arr) => (
          <div
            key={i}
            className={`flex items-center justify-between px-3 py-2 text-xs ${i < arr.length - 1 ? "border-b border-glass-border" : ""}`}
          >
            <span className="text-foreground w-32">{entry.name}</span>
            <span className="text-muted-foreground font-mono">
              {entry.from} <ChevronRight className="size-3 inline" /> {entry.to}
            </span>
            <span className="text-muted-foreground">{entry.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppearanceSection({
  appearance,
  wallpaperOptions,
  accentOptions,
  onAppearanceChange,
}: {
  appearance: AppearanceSettings;
  wallpaperOptions: WallpaperOption[];
  accentOptions: AccentColorOption[];
  onAppearanceChange: (patch: Partial<AppearanceSettings>) => void;
}) {
  const themeOptions: {
    name: string;
    value: AppearanceSettings["theme"];
    preview: string;
  }[] = [
    { name: "Dark", value: "dark", preview: "oklch(0.13 0.015 250)" },
    { name: "Light", value: "light", preview: "oklch(0.97 0.005 250)" },
    {
      name: "System",
      value: "system",
      preview:
        "linear-gradient(135deg, oklch(0.13 0.015 250) 50%, oklch(0.97 0.005 250) 50%)",
    },
  ];

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Theme" />
      <div className="flex items-center gap-3 py-2">
        {themeOptions.map((theme) => (
          <button
            key={theme.name}
            onClick={() => onAppearanceChange({ theme: theme.value })}
            className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer ${
              appearance.theme === theme.value
                ? "border-primary bg-primary/10"
                : "border-glass-border bg-secondary/20 hover:bg-secondary/40"
            }`}
          >
            <div
              className="w-16 h-10 rounded-lg border border-glass-border"
              style={{ background: theme.preview }}
            />
            <span
              className={`text-xs ${
                appearance.theme === theme.value
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {theme.name}
            </span>
          </button>
        ))}
      </div>

      <SectionDivider title="Accent Color" />
      <div className="flex items-center gap-2 py-2">
        {accentOptions.map((color) => (
          <button
            key={color.name}
            onClick={() => onAppearanceChange({ accentColor: color.value })}
            className={`size-8 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center ${
              appearance.accentColor === color.value
                ? "border-foreground scale-110"
                : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: color.value }}
            title={color.name}
          >
            {appearance.accentColor === color.value && (
              <Check className="size-3.5 text-primary-foreground" />
            )}
          </button>
        ))}
      </div>

      <SectionDivider title="Wallpaper" />
      <div className="grid grid-cols-4 gap-2 py-2">
        {wallpaperOptions.map((wallpaper) => (
          <button
            key={wallpaper.id}
            onClick={() => onAppearanceChange({ wallpaper: wallpaper.src })}
            className={`w-20 h-12 rounded-lg border-2 transition-all cursor-pointer overflow-hidden ${
              appearance.wallpaper === wallpaper.src
                ? "border-primary"
                : "border-glass-border hover:border-foreground/30"
            }`}
            title={wallpaper.name}
          >
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url('${wallpaper.src}')`,
                backgroundSize: "cover",
              }}
            />
          </button>
        ))}
      </div>

      <SectionDivider title="Display" />
      <SettingsSelect
        label="Icon size"
        value={
          appearance.iconSize === "small"
            ? "Small"
            : appearance.iconSize === "large"
              ? "Large"
              : "Medium"
        }
        options={["Small", "Medium", "Large"]}
        onChange={(value) =>
          onAppearanceChange({
            iconSize:
              value === "Small"
                ? "small"
                : value === "Large"
                  ? "large"
                  : "medium",
          })
        }
      />
      <SettingsSelect
        label="Font size"
        value={
          appearance.fontSize === "compact"
            ? "Compact"
            : appearance.fontSize === "large"
              ? "Large"
              : appearance.fontSize === "extra-large"
                ? "Extra Large"
                : "Default"
        }
        options={["Compact", "Default", "Large", "Extra Large"]}
        onChange={(value) =>
          onAppearanceChange({
            fontSize:
              value === "Compact"
                ? "compact"
                : value === "Large"
                  ? "large"
                  : value === "Extra Large"
                    ? "extra-large"
                    : "default",
          })
        }
      />
      <Toggle
        label="Animations"
        description="Enable smooth transitions and hover effects"
        enabled={appearance.animationsEnabled}
        onToggle={() =>
          onAppearanceChange({
            animationsEnabled: !appearance.animationsEnabled,
          })
        }
      />
      <SettingsSelect
        label="Dock position"
        value={
          appearance.dockPosition === "left"
            ? "Left"
            : appearance.dockPosition === "right"
              ? "Right"
              : "Bottom"
        }
        options={["Bottom", "Left", "Right"]}
        onChange={(value) =>
          onAppearanceChange({
            dockPosition: value.toLowerCase() as DockPosition,
          })
        }
      />
    </div>
  );
}

function PowerSection() {
  const [scheduledReboot, setScheduledReboot] = useState(false);
  const [uptimeAlerts, setUptimeAlerts] = useState(true);

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Power Management" />
      <InfoBanner
        text="These actions will affect all running services. Make sure to save your work before proceeding."
        variant="warning"
      />

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
      <Toggle
        label="Scheduled reboot"
        description="Automatically reboot the server on a set schedule"
        enabled={scheduledReboot}
        onToggle={() => setScheduledReboot(!scheduledReboot)}
      />
      {scheduledReboot && (
        <>
          <SettingsSelect
            label="Day"
            value="Sunday"
            options={[
              "Daily",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ]}
          />
          <SettingsSelect
            label="Time"
            value="04:00 AM"
            options={[
              "12:00 AM",
              "01:00 AM",
              "02:00 AM",
              "03:00 AM",
              "04:00 AM",
              "05:00 AM",
              "06:00 AM",
            ]}
          />
        </>
      )}

      <SectionDivider title="UPS" />
      <div className="rounded-xl border border-glass-border bg-secondary/20 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-status-green" />
            <span className="text-sm text-foreground font-medium">
              APC Back-UPS 1500VA
            </span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-status-green/15 text-status-green font-medium">
            Online
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-xs text-muted-foreground block">
              Battery
            </span>
            <span className="text-foreground">98%</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Load
            </span>
            <span className="text-foreground">340W / 900W</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">
              Runtime
            </span>
            <span className="text-foreground">~45 min</span>
          </div>
        </div>
      </div>
      <SettingsSelect
        label="On battery action"
        value="Shutdown after 10 min"
        options={[
          "Shutdown after 5 min",
          "Shutdown after 10 min",
          "Shutdown after 30 min",
          "Hibernate",
          "Do nothing",
        ]}
        description="Action to take when power is lost"
      />

      <SectionDivider title="Monitoring" />
      <Toggle
        label="Uptime alerts"
        description="Get notified if server goes offline unexpectedly"
        enabled={uptimeAlerts}
        onToggle={() => setUptimeAlerts(!uptimeAlerts)}
      />

      <SectionDivider title="Factory Reset" />
      <InfoBanner
        text="Factory reset will erase all settings and restore the server to its default configuration. Your files and media will not be affected."
        variant="warning"
      />
      <button className="self-start mt-2 px-4 py-2 text-xs font-medium rounded-lg bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors cursor-pointer">
        Factory Reset Server
      </button>
    </div>
  );
}

// =====================
// Section Renderer
// =====================

function renderSection({
  id,
  appearance,
  wallpaperOptions,
  accentOptions,
  onAppearanceChange,
  settingsBackend,
}: {
  id: string;
  appearance: AppearanceSettings;
  wallpaperOptions: WallpaperOption[];
  accentOptions: AccentColorOption[];
  onAppearanceChange: (patch: Partial<AppearanceSettings>) => void;
  settingsBackend: ReturnType<typeof useSettingsBackend>;
}) {
  const unsupportedControlContext = {
    disabled: true,
    disabledReason: settingsBackend.capabilities.unsupportedSectionReason,
  } as const;

  switch (id) {
    case "general":
      return (
        <GeneralSection
          data={settingsBackend.general}
          capabilities={settingsBackend.capabilities.general}
        />
      );
    case "network":
      return (
        <NetworkSection
          data={settingsBackend.network}
          capabilities={settingsBackend.capabilities.network}
        />
      );
    case "storage":
      return (
        <ControlAvailabilityContext.Provider value={unsupportedControlContext}>
          <div className="flex flex-col gap-2">
            <InfoBanner text={settingsBackend.capabilities.unsupportedSectionReason} />
            <fieldset disabled className="opacity-70">
              <StorageSection />
            </fieldset>
          </div>
        </ControlAvailabilityContext.Provider>
      );
    case "docker":
      return (
        <DockerSection
          data={settingsBackend.docker}
          capabilities={settingsBackend.capabilities.docker}
        />
      );
    case "users":
      return (
        <ControlAvailabilityContext.Provider value={unsupportedControlContext}>
          <div className="flex flex-col gap-2">
            <InfoBanner text={settingsBackend.capabilities.unsupportedSectionReason} />
            <fieldset disabled className="opacity-70">
              <UsersSection />
            </fieldset>
          </div>
        </ControlAvailabilityContext.Provider>
      );
    case "security":
      return (
        <ControlAvailabilityContext.Provider value={unsupportedControlContext}>
          <div className="flex flex-col gap-2">
            <InfoBanner text={settingsBackend.capabilities.unsupportedSectionReason} />
            <fieldset disabled className="opacity-70">
              <SecuritySection />
            </fieldset>
          </div>
        </ControlAvailabilityContext.Provider>
      );
    case "notifications":
      return (
        <ControlAvailabilityContext.Provider value={unsupportedControlContext}>
          <div className="flex flex-col gap-2">
            <InfoBanner text={settingsBackend.capabilities.unsupportedSectionReason} />
            <fieldset disabled className="opacity-70">
              <NotificationsSection />
            </fieldset>
          </div>
        </ControlAvailabilityContext.Provider>
      );
    case "backup":
      return (
        <ControlAvailabilityContext.Provider value={unsupportedControlContext}>
          <div className="flex flex-col gap-2">
            <InfoBanner text={settingsBackend.capabilities.unsupportedSectionReason} />
            <fieldset disabled className="opacity-70">
              <BackupSection />
            </fieldset>
          </div>
        </ControlAvailabilityContext.Provider>
      );
    case "updates":
      return (
        <UpdatesSection
          data={settingsBackend.updates}
          capabilities={settingsBackend.capabilities.updates}
          onCheckForUpdates={settingsBackend.actions.checkForUpdates}
        />
      );
    case "appearance":
      return (
        <AppearanceSection
          appearance={appearance}
          wallpaperOptions={wallpaperOptions}
          accentOptions={accentOptions}
          onAppearanceChange={onAppearanceChange}
        />
      );
    case "power":
      return (
        <ControlAvailabilityContext.Provider value={unsupportedControlContext}>
          <div className="flex flex-col gap-2">
            <InfoBanner text={settingsBackend.capabilities.unsupportedSectionReason} />
            <fieldset disabled className="opacity-70">
              <PowerSection />
            </fieldset>
          </div>
        </ControlAvailabilityContext.Provider>
      );
    default:
      return null;
  }
}

// =====================
// Main Settings Component
// =====================

type SettingsPanelProps = {
  appearance: AppearanceSettings;
  wallpaperOptions: WallpaperOption[];
  accentOptions: AccentColorOption[];
  onAppearanceChange: (patch: Partial<AppearanceSettings>) => void;
  selectedSection?: string | null;
};

export function SettingsPanel({
  appearance,
  wallpaperOptions,
  accentOptions,
  onAppearanceChange,
  selectedSection,
}: SettingsPanelProps) {
  const settingsBackend = useSettingsBackend();
  const [activeSection, setActiveSection] = useState(
    selectedSection && sections.some((section) => section.id === selectedSection)
      ? selectedSection
      : "general",
  );

  useEffect(() => {
    if (!selectedSection) return;
    if (!sections.some((section) => section.id === selectedSection)) return;
    setActiveSection(selectedSection);
  }, [selectedSection]);

  const isLiveApplySection = activeSection === "appearance";
  const sectionSaveEnabled =
    settingsBackend.capabilities.saveBySection[
      activeSection as keyof typeof settingsBackend.capabilities.saveBySection
    ] ?? false;

  const sectionsWithBadges = sections.map((section) =>
    section.id === "updates"
      ? {
          ...section,
          badge:
            settingsBackend.updates.availableCount > 0
              ? String(settingsBackend.updates.availableCount)
              : undefined,
        }
      : section,
  );

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <aside className="w-52 shrink-0 border-r border-glass-border bg-glass flex flex-col overflow-y-auto">
        <div className="p-3 pt-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-2">
            Settings
          </span>
          <div className="flex flex-col gap-0.5 mt-2">
            {sectionsWithBadges.map((section) => {
              const isActive = activeSection === section.id;
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
                  <section.icon
                    className={`size-4 ${isActive ? "text-primary" : ""}`}
                  />
                  <span className="flex-1 text-left truncate">
                    {section.label}
                  </span>
                  {section.badge && (
                    <span className="size-4.5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      {section.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Server info footer */}
        <div className="mt-auto p-3 border-t border-glass-border">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-status-green" />
            <span className="text-xs text-muted-foreground">
              {settingsBackend.general.hostname}
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            {settingsBackend.general.appVersion} | {settingsBackend.general.platform}
          </span>
        </div>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {sections.find((s) => s.id === activeSection)?.label}
            </h2>
            {!isLiveApplySection && (
              <button
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-primary/90"
                disabled={!sectionSaveEnabled}
                title={settingsBackend.capabilities.saveDisabledReason}
              >
                Save Changes
              </button>
            )}
          </div>
          {renderSection({
            id: activeSection,
            appearance,
            wallpaperOptions,
            accentOptions,
            onAppearanceChange,
            settingsBackend,
          })}
        </div>
      </main>
    </div>
  );
}
