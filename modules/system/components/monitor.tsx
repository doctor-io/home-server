"use client";

import { formatBytesCompact, formatUptimeShort } from "@/lib/client/format";
import {
  calculateDockerTotals,
  containerToProcess,
  getStatusBadgeColor,
} from "@/lib/client/monitor-utils";
import { useDockerStats } from "@/modules/system/hooks/useDockerStats";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
import { DiskManager } from "@/modules/system/components/disk-manager";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Container,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  Search,
} from "@/components/icons/platform-icons";
import { PANEL_INSET } from "@/lib/ui/surface-tokens";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type MonitorTab = "processes" | "network" | "disks";
type SortKey = "cpu" | "memory" | "network" | "disk";

const TABS: { id: MonitorTab; label: string }[] = [
  { id: "processes", label: "Processes" },
  { id: "network", label: "Network" },
  { id: "disks", label: "Disks" },
];

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({
  label,
  icon: Icon,
  value,
  sub,
  color,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className={cn(PANEL_INSET, "flex flex-col gap-2 px-4 py-3")}>
      <div className="flex items-center justify-between">
        <span className="text-3xs font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
          {label}
        </span>
        <div className={cn("flex size-6 items-center justify-center rounded-md border border-glass-border/60 bg-background/55", color)}>
          <Icon className="size-3" />
        </div>
      </div>
      <div className="font-mono text-2xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-2xs text-muted-foreground/70">{sub}</div>
    </div>
  );
}

// ── History bars ──────────────────────────────────────────────────────────────

/**
 * Samples are drawn into a fixed number of slots rather than stretched to fill
 * the card. Stretching made each bar ~10px wide and, worse, changed their width
 * as history accumulated — so the same load looked different minute to minute.
 * Empty slots keep the time window visible while it fills.
 */
/** ~4 minutes at the default 2s metrics publish interval. */
const HISTORY_CAPACITY = 120;

function HistoryBars({ values, color }: { values: number[]; color: string }) {
  const slots = Array.from({ length: HISTORY_CAPACITY }, (_, index) => {
    const offset = index - (HISTORY_CAPACITY - values.length);
    return offset >= 0 ? values[offset] : null;
  });

  return (
    <div className={cn(PANEL_INSET, "flex h-16 items-end gap-px px-2 py-1.5")}>
      {values.length === 0 ? (
        <span className="m-auto text-xs text-muted-foreground/50">Collecting…</span>
      ) : (
        slots.map((value, index) => (
          <span
            key={index}
            className={cn(
              "min-w-0 flex-1 rounded-[1px] transition-[height] duration-300",
              value === null ? "bg-white/6" : color,
            )}
            // A floor of 2% keeps an idle reading visible as a baseline rather
            // than an absent bar, without inflating it the way a 4% floor did.
            style={{ height: value === null ? "2px" : `${Math.max(2, Math.round(value))}%` }}
          />
        ))
      )}
    </div>
  );
}

// ── Resource history card ─────────────────────────────────────────────────────

function ResourceHistoryCard({
  icon: Icon,
  title,
  iconColor,
  barColor,
  history,
  rows,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconColor: string;
  barColor: string;
  history: number[];
  rows: { label: string; value: string }[];
}) {
  return (
    <div className={cn(PANEL_INSET, "flex flex-col gap-2 p-3")}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-3.5", iconColor)} />
        <span className="text-xs font-semibold text-foreground">{title}</span>
      </div>
      <HistoryBars values={history} color={barColor} />
      <div className="divide-y divide-glass-border/40">
        {rows.map((r) => (
          <InfoRow key={r.label} label={r.label} value={r.value} mono />
        ))}
      </div>
    </div>
  );
}

// ── Info row ──────────────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-medium text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}

// ── Monitor ───────────────────────────────────────────────────────────────────

export function Monitor() {
  const [tab, setTab] = useState<MonitorTab>("processes");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("cpu");
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [peakCpu, setPeakCpu] = useState(0);
  const [peakMem, setPeakMem] = useState(0);

  const { data: systemMetrics } = useSystemMetrics();
  const { stats: dockerStats, daemonAvailable, isConnected: dockerConnected } = useDockerStats();

  const dockerTotals = useMemo(() => calculateDockerTotals(dockerStats), [dockerStats]);

  useEffect(() => {
    if (!systemMetrics) return;
    const cpu = systemMetrics.cpu.normalizedPercent ?? 0;
    const mem = systemMetrics.memory.usedPercent ?? 0;
    setCpuHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === cpu) return prev;
      return [...prev.slice(-(HISTORY_CAPACITY - 1)), cpu];
    });
    setMemHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === mem) return prev;
      return [...prev.slice(-(HISTORY_CAPACITY - 1)), mem];
    });
    setPeakCpu((prev) => Math.max(prev, cpu));
    setPeakMem((prev) => Math.max(prev, mem));
  }, [systemMetrics]);

  const dockerProcesses = useMemo(() => dockerStats.map(containerToProcess), [dockerStats]);

  const filteredProcesses = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? dockerProcesses.filter((p) => p.name.toLowerCase().includes(q)) : dockerProcesses;
    return [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [dockerProcesses, query, sortBy]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-glass-border/60 px-4 py-2.5">
        <div className="flex items-center gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {tab === "processes" && (
          <div className="relative w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search containers…"
              className="w-full rounded-lg border border-glass-border bg-background/55 py-1.5 pl-8 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
            />
          </div>
        )}
      </div>

      {/* ── Processes tab ── */}
      {tab === "processes" && (
        <div className="flex-1 overflow-y-auto p-3">
          {/* Metric summary */}
          <div className="mb-3 grid grid-cols-5 gap-2">
            <MetricCard
              label="CPU"
              icon={Cpu}
              value={`${systemMetrics?.cpu.normalizedPercent?.toFixed(1) ?? "--"}%`}
              sub="System average"
              color="text-primary"
            />
            <MetricCard
              label="Memory"
              icon={MemoryStick}
              value={`${systemMetrics?.memory.usedPercent?.toFixed(1) ?? "--"}%`}
              sub={
                systemMetrics?.memory.usedBytes && systemMetrics?.memory.totalBytes
                  ? `${(systemMetrics.memory.usedBytes / 1024 ** 3).toFixed(1)} / ${(systemMetrics.memory.totalBytes / 1024 ** 3).toFixed(1)} GB`
                  : "--"
              }
              color="text-chart-2"
            />
            <MetricCard
              label="Containers"
              icon={Container}
              value={`${dockerStats.length}`}
              sub={
                daemonAvailable === false
                  ? "daemon unreachable"
                  : `${dockerStats.filter((c) => c.state === "running").length} running`
              }
              color={daemonAvailable === false ? "text-status-amber" : "text-chart-4"}
            />
            <MetricCard
              label="Net RX"
              icon={ArrowDown}
              value={`${(dockerTotals.totalNetworkRx / 1024 ** 2).toFixed(1)}`}
              sub="MB received"
              color="text-status-green"
            />
            <MetricCard
              label="Net TX"
              icon={ArrowUp}
              value={`${(dockerTotals.totalNetworkTx / 1024 ** 2).toFixed(1)}`}
              sub="MB sent"
              color="text-sky-400"
            />
          </div>

          {/* Resource charts */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <ResourceHistoryCard
              icon={Cpu}
              title="CPU History"
              iconColor="text-primary"
              barColor="bg-primary/80"
              history={cpuHistory}
              rows={[
                { label: "Current", value: `${systemMetrics?.cpu.normalizedPercent?.toFixed(1) ?? "--"}%` },
                { label: "Peak", value: peakCpu > 0 ? `${peakCpu.toFixed(0)}%` : "--" },
              ]}
            />
            <ResourceHistoryCard
              icon={MemoryStick}
              title="Memory Pressure"
              iconColor="text-chart-2"
              barColor="bg-chart-2/80"
              history={memHistory}
              rows={[
                { label: "Used %", value: `${systemMetrics?.memory.usedPercent?.toFixed(1) ?? "--"}%` },
                { label: "Used", value: systemMetrics?.memory.usedBytes ? `${(systemMetrics.memory.usedBytes / 1024 ** 3).toFixed(1)} GB` : "--" },
              ]}
            />

            <div className={cn(PANEL_INSET, "flex flex-col gap-2 p-3")}>
              <div className="flex items-center gap-2">
                <HardDrive className="size-3.5 text-chart-4" />
                <span className="text-xs font-semibold text-foreground">Disk Usage</span>
              </div>
              {systemMetrics?.storage ? (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background/65">
                    <div className="h-full rounded-full bg-chart-4 transition-all duration-300" style={{ width: `${systemMetrics.storage.usedPercent.toFixed(1)}%` }} />
                  </div>
                  <div className="divide-y divide-glass-border/40">
                    <InfoRow label="Used" value={formatBytesCompact(systemMetrics.storage.usedBytes)} mono />
                    <InfoRow label="Total" value={formatBytesCompact(systemMetrics.storage.totalBytes)} mono />
                    <InfoRow label="Usage" value={`${systemMetrics.storage.usedPercent.toFixed(1)}%`} mono />
                  </div>
                </>
              ) : (
                <p className="py-4 text-center text-xs text-muted-foreground/60">Storage data unavailable</p>
              )}
            </div>

            <div className={cn(PANEL_INSET, "flex flex-col gap-2 p-3")}>
              <div className="flex items-center gap-2">
                <Gauge className="size-3.5 text-status-amber" />
                <span className="text-xs font-semibold text-foreground">Load Average</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "1m", value: systemMetrics?.cpu.oneMinute?.toFixed(2) },
                  { label: "5m", value: systemMetrics?.cpu.fiveMinute?.toFixed(2) },
                  { label: "15m", value: systemMetrics?.cpu.fifteenMinute?.toFixed(2) },
                ].map(({ label, value }) => (
                  <div key={label} className={cn(PANEL_INSET, "flex flex-col items-center gap-1 py-3")}>
                    <span className="font-mono text-sm font-bold text-foreground">{value ?? "--"}</span>
                    <span className="text-2xs text-muted-foreground/60">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Container table */}
          <div className={cn(PANEL_INSET, "overflow-hidden")}>
            <div className="flex items-center justify-between border-b border-glass-border/50 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Container className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Docker Containers</span>
                {dockerConnected && daemonAvailable !== false && (
                  <span className="flex items-center gap-1 text-2xs text-status-green">
                    <span className="size-1.5 rounded-full bg-status-green" />
                    Live
                  </span>
                )}
              </div>
              {daemonAvailable === false && (
                <span className="flex items-center gap-1.5 text-xs text-status-amber">
                  <AlertTriangle className="size-3.5" />
                  Docker daemon unreachable
                </span>
              )}
              {daemonAvailable !== false && dockerStats.length === 0 && (
                <span className="text-xs text-muted-foreground/60">No containers running</span>
              )}
            </div>

            <div className="grid grid-cols-[2.2fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 border-b border-glass-border/40 px-4 py-2 text-3xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
              <span>Container</span>
              <span>Status</span>
              {(["cpu", "memory", "network", "disk"] as SortKey[]).map((key, i) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={cn(
                    "text-left transition-colors hover:text-foreground",
                    sortBy === key ? "text-primary" : "",
                  )}
                >
                  {["CPU %", "Mem MB", "Net MB", "Disk MB"][i]}
                </button>
              ))}
            </div>

            {filteredProcesses.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                {daemonAvailable === false
                  ? "Cannot connect to Docker daemon"
                  : query
                    ? "No containers match your search"
                    : "No containers running"}
              </div>
            ) : (
              <div className="divide-y divide-glass-border/40">
                {filteredProcesses.map((p) => (
                  <div
                    key={`${p.name}-${p.pid}`}
                    className="grid grid-cols-[2.2fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-4 py-2.5 text-xs transition-colors hover:bg-background/30"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55 text-xs font-bold text-primary">
                        {p.name[0]?.toUpperCase() ?? "C"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                        <p className="font-mono text-2xs text-muted-foreground/60">{p.pid}</p>
                      </div>
                    </div>
                    <span className={cn("flex items-center")}>
                      <span className={cn("rounded-md px-2 py-0.5 text-2xs font-medium", getStatusBadgeColor(p.status))}>
                        {p.status}
                      </span>
                    </span>
                    <span className="flex items-center font-mono text-foreground">{p.cpu.toFixed(1)}%</span>
                    <span className="flex items-center font-mono text-foreground">{Math.round(p.memory)} MB</span>
                    <span className="flex items-center font-mono text-foreground">{p.network.toFixed(1)} MB</span>
                    <span className="flex items-center font-mono text-foreground">{p.disk.toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Disks tab ── */}
      {tab === "disks" && <DiskManager />}

      {/* ── Network tab ── */}
      {tab === "network" && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-2">
            {systemMetrics?.wifi.connected ? (
              <div className={cn(PANEL_INSET, "overflow-hidden")}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                      <Network className="size-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{systemMetrics.wifi.iface ?? "Network"}</p>
                      <p className="text-2xs text-muted-foreground/70">
                        {systemMetrics.wifi.ssid ?? "Connected"} · {systemMetrics.wifi.ipv4 ?? "No IP"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-md bg-status-green/12 px-2 py-0.5 text-xs font-medium text-status-green">
                    Connected
                  </span>
                </div>
                <div className="divide-y divide-glass-border/40 border-t border-glass-border/50 px-4">
                  <InfoRow label="Download" value={`${systemMetrics.wifi.downloadMbps?.toFixed(1) ?? "--"} Mbps`} mono />
                  <InfoRow label="Upload" value={`${systemMetrics.wifi.uploadMbps?.toFixed(1) ?? "--"} Mbps`} mono />
                  <InfoRow label="Signal" value={`${systemMetrics.wifi.signalPercent ?? "--"}%`} mono />
                  <InfoRow label="TX Rate" value={`${systemMetrics.wifi.txRateMbps?.toFixed(0) ?? "--"} Mbps`} mono />
                </div>
              </div>
            ) : (
              <div className={cn(PANEL_INSET, "flex flex-col items-center gap-2 py-8 text-center")}>
                <Network className="size-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No active network connection</p>
              </div>
            )}

            <div className={cn(PANEL_INSET, "overflow-hidden")}>
              <div className="flex items-center gap-2 border-b border-glass-border/50 px-4 py-3">
                <Container className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Container Network Activity</span>
              </div>
              {daemonAvailable === false ? (
                <p className="px-4 py-4 text-xs text-muted-foreground/60">Docker daemon unreachable</p>
              ) : (
                <div className="grid grid-cols-2 divide-x divide-glass-border/50">
                  {[
                    { label: "MB Received", value: (dockerTotals.totalNetworkRx / 1024 ** 2).toFixed(1) },
                    { label: "MB Sent", value: (dockerTotals.totalNetworkTx / 1024 ** 2).toFixed(1) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-1 py-4">
                      <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{value}</span>
                      <span className="text-2xs text-muted-foreground/60">{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={cn(PANEL_INSET, "overflow-hidden")}>
              <div className="flex items-center gap-2 border-b border-glass-border/50 px-4 py-3">
                <Activity className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">System Info</span>
              </div>
              <div className="divide-y divide-glass-border/40 px-4">
                <InfoRow label="Hostname" value={systemMetrics?.hostname ?? "--"} mono />
                <InfoRow label="Platform" value={systemMetrics?.platform ?? "--"} mono />
                <InfoRow
                  label="Uptime"
                  value={systemMetrics?.uptimeSeconds ? formatUptimeShort(systemMetrics.uptimeSeconds) : "--"}
                  mono
                />
                <InfoRow
                  label="Containers"
                  value={daemonAvailable === false ? "unavailable" : `${dockerStats.length} total`}
                  mono
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
