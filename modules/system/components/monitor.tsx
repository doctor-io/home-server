"use client";

import { formatUptimeShort } from "@/lib/client/format";
import {
    calculateDockerTotals,
    containerToProcess,
    getStatusBadgeColor,
} from "@/lib/client/monitor-utils";
import { useDockerStats } from "@/modules/system/hooks/useDockerStats";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
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
import { useEffect, useMemo, useState } from "react";

type MonitorTab = "processes" | "resources" | "network";
type SortKey = "cpu" | "memory" | "network" | "disk";

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
    <div className="rounded-xl border border-glass-border bg-glass p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className={`size-3.5 ${color}`} />
      </div>
      <div className="text-xl font-semibold text-foreground font-mono">
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function HistoryBars({ values, color }: { values: number[]; color: string }) {
  return (
    <div className="flex h-16 items-end gap-1 rounded-xl border border-glass-border bg-glass p-2">
      {values.length === 0 ? (
        <span className="m-auto text-xs text-muted-foreground">
          Collecting…
        </span>
      ) : (
        values.map((v, i) => (
          <span
            key={`${i}-${v}`}
            className={`w-1.5 rounded-sm ${color} transition-all duration-300`}
            style={{ height: `${Math.max(6, Math.round(v))}%` }}
          />
        ))
      )}
    </div>
  );
}

/** Format bytes to a human-readable string (KB / MB / GB / TB). */
function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 4) return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

export function Monitor() {
  const [tab, setTab] = useState<MonitorTab>("processes");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("cpu");
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);

  // Real system metrics (updated continuously via useSystemSse)
  const { data: systemMetrics } = useSystemMetrics();
  const {
    stats: dockerStats,
    daemonAvailable,
    isConnected: dockerConnected,
  } = useDockerStats();

  // Calculate total Docker stats
  const dockerTotals = useMemo(
    () => calculateDockerTotals(dockerStats),
    [dockerStats],
  );

  // Append real system metrics to rolling history arrays
  useEffect(() => {
    if (!systemMetrics) return;

    const cpuValue = systemMetrics.cpu.normalizedPercent ?? 0;
    const memValue = systemMetrics.memory.usedPercent ?? 0;

    setCpuHistory((prev) => [...prev.slice(-23), cpuValue]);
    setMemHistory((prev) => [...prev.slice(-23), memValue]);
  }, [systemMetrics]);

  // Convert Docker stats to process format
  const dockerProcesses = useMemo(
    () => dockerStats.map(containerToProcess),
    [dockerStats],
  );

  const filteredProcesses = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? dockerProcesses.filter((p) => p.name.toLowerCase().includes(q))
      : dockerProcesses;

    return [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [dockerProcesses, query, sortBy]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-glass-border px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-glass p-0.5">
          {[
            { id: "processes" as const, label: "Processes" },
            { id: "resources" as const, label: "Resources" },
            { id: "network" as const, label: "Network" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                tab === item.id
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {tab === "processes" && (
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search container..."
              className="w-full rounded-lg border border-glass-border bg-glass py-1.5 pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
            />
          </div>
        )}
      </div>

      {tab === "processes" && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 grid grid-cols-5 gap-2">
            <MetricCard
              label="CPU Load"
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
                systemMetrics?.memory.usedBytes &&
                systemMetrics?.memory.totalBytes
                  ? `${(systemMetrics.memory.usedBytes / 1024 / 1024 / 1024).toFixed(1)} / ${(systemMetrics.memory.totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
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
              color={
                daemonAvailable === false ? "text-status-amber" : "text-chart-4"
              }
            />
            <MetricCard
              label="Network RX"
              icon={ArrowDown}
              value={`${(dockerTotals.totalNetworkRx / 1024 / 1024).toFixed(1)} MB`}
              sub="Total received"
              color="text-status-green"
            />
            <MetricCard
              label="Network TX"
              icon={ArrowUp}
              value={`${(dockerTotals.totalNetworkTx / 1024 / 1024).toFixed(1)} MB`}
              sub="Total sent"
              color="text-sky-400"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-glass-border bg-glass">
            <div className="flex items-center justify-between border-b border-glass-border px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Container className="size-3.5" />
                <span>Docker Containers</span>
                {dockerConnected && daemonAvailable !== false && (
                  <span className="text-status-green">● Live</span>
                )}
              </div>
              {daemonAvailable === false && (
                <span className="flex items-center gap-1 text-xs text-status-amber">
                  <AlertTriangle className="size-3.5" />
                  Docker daemon unreachable
                </span>
              )}
              {daemonAvailable !== false && dockerStats.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No containers running
                </span>
              )}
            </div>
            <div className="grid grid-cols-[2.2fr_0.8fr_1fr_1fr_1fr_1fr] gap-2 border-b border-glass-border px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground">
              <span>Container</span>
              <span>Status</span>
              <button
                onClick={() => setSortBy("cpu")}
                className={`cursor-pointer text-left hover:text-foreground ${sortBy === "cpu" ? "text-primary" : ""}`}
              >
                CPU %
              </button>
              <button
                onClick={() => setSortBy("memory")}
                className={`cursor-pointer text-left hover:text-foreground ${sortBy === "memory" ? "text-primary" : ""}`}
              >
                Memory MB
              </button>
              <button
                onClick={() => setSortBy("network")}
                className={`cursor-pointer text-left hover:text-foreground ${sortBy === "network" ? "text-primary" : ""}`}
              >
                Net MB
              </button>
              <button
                onClick={() => setSortBy("disk")}
                className={`cursor-pointer text-left hover:text-foreground ${sortBy === "disk" ? "text-primary" : ""}`}
              >
                Disk MB
              </button>
            </div>

            {filteredProcesses.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                {daemonAvailable === false
                  ? "Cannot connect to Docker daemon"
                  : query
                    ? "No containers match your search"
                    : "No containers running"}
              </div>
            ) : (
              filteredProcesses.map((p) => (
                <div
                  key={`${p.name}-${p.pid}`}
                  className="grid grid-cols-[2.2fr_0.8fr_1fr_1fr_1fr_1fr] gap-2 border-b border-glass-border/60 px-3 py-2.5 text-xs last:border-none hover:bg-secondary/35"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {p.name[0]?.toUpperCase() ?? "C"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {p.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID: {p.pid}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span
                      className={`rounded-[var(--radius)] px-2 py-0.5 text-xs ${getStatusBadgeColor(p.status)}`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <span className="flex items-center font-mono text-foreground">
                    {p.cpu.toFixed(1)}%
                  </span>
                  <span className="flex items-center font-mono text-foreground">
                    {Math.round(p.memory)} MB
                  </span>
                  <span className="flex items-center font-mono text-foreground">
                    {p.network.toFixed(1)} MB
                  </span>
                  <span className="flex items-center font-mono text-foreground">
                    {p.disk.toFixed(1)} MB
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tab === "resources" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <Cpu className="size-3.5 text-primary" /> CPU History
              </div>
              <HistoryBars values={cpuHistory} color="bg-primary/85" />
              <p className="mt-2 text-xs text-muted-foreground">
                Current{" "}
                {systemMetrics?.cpu.normalizedPercent?.toFixed(1) ?? "--"}% |
                Peak{" "}
                {cpuHistory.length > 0
                  ? Math.max(...cpuHistory).toFixed(0)
                  : "--"}
                %
              </p>
            </div>

            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <MemoryStick className="size-3.5 text-chart-2" /> Memory
                Pressure
              </div>
              <HistoryBars values={memHistory} color="bg-chart-2/85" />
              <p className="mt-2 text-xs text-muted-foreground">
                Current {systemMetrics?.memory.usedPercent?.toFixed(1) ?? "--"}%
                |
                {systemMetrics?.memory.usedBytes
                  ? ` Used ${(systemMetrics.memory.usedBytes / 1024 / 1024 / 1024).toFixed(1)} GB`
                  : ""}
              </p>
            </div>

            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <HardDrive className="size-3.5 text-chart-4" /> Disk Usage
              </div>
              {systemMetrics?.storage ? (
                <>
                  <div className="h-2 overflow-hidden rounded-[var(--radius)] bg-secondary/60">
                    <div
                      className="h-full bg-chart-4 transition-all duration-300"
                      style={{
                        width: `${systemMetrics.storage.usedPercent.toFixed(1)}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {formatBytes(systemMetrics.storage.usedBytes)}
                      {" / "}
                      {formatBytes(systemMetrics.storage.totalBytes)}
                    </span>
                    <span className="font-mono">
                      {systemMetrics.storage.usedPercent.toFixed(1)}%
                    </span>
                  </div>
                </>
              ) : (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Storage data unavailable
                </p>
              )}
            </div>

            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <Gauge className="size-3.5 text-status-amber" /> Load Average
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-secondary/40 py-2">
                  <p className="text-sm font-mono text-foreground">
                    {systemMetrics?.cpu.oneMinute?.toFixed(2) ?? "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">1m</p>
                </div>
                <div className="rounded-lg bg-secondary/40 py-2">
                  <p className="text-sm font-mono text-foreground">
                    {systemMetrics?.cpu.fiveMinute?.toFixed(2) ?? "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">5m</p>
                </div>
                <div className="rounded-lg bg-secondary/40 py-2">
                  <p className="text-sm font-mono text-foreground">
                    {systemMetrics?.cpu.fifteenMinute?.toFixed(2) ?? "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">15m</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "network" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            {/* WiFi Connection */}
            {systemMetrics?.wifi.connected && (
              <div className="rounded-xl border border-glass-border bg-glass p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="size-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {systemMetrics.wifi.iface ?? "WiFi"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {systemMetrics.wifi.ssid ?? "Connected"} •{" "}
                        {systemMetrics.wifi.ipv4 ?? "No IP"}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-[var(--radius)] bg-status-green/15 px-2 py-0.5 text-xs text-status-green">
                    Connected
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
                      <ArrowDown className="size-3 text-status-green" />{" "}
                      Download
                    </p>
                    <p className="text-sm font-mono text-foreground">
                      {systemMetrics.wifi.downloadMbps?.toFixed(1) ?? "--"} Mbps
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground">
                      <ArrowUp className="size-3 text-sky-400" /> Upload
                    </p>
                    <p className="text-sm font-mono text-foreground">
                      {systemMetrics.wifi.uploadMbps?.toFixed(1) ?? "--"} Mbps
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="mb-1 text-xs text-muted-foreground">Signal</p>
                    <p className="text-sm font-mono text-foreground">
                      {systemMetrics.wifi.signalPercent ?? "--"}%
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="mb-1 text-xs text-muted-foreground">
                      TX Rate
                    </p>
                    <p className="text-sm font-mono text-foreground">
                      {systemMetrics.wifi.txRateMbps?.toFixed(0) ?? "--"} Mbps
                    </p>
                  </div>
                </div>
              </div>
            )}

            {!systemMetrics?.wifi.connected && (
              <div className="rounded-xl border border-glass-border bg-glass p-4 text-center">
                <Network className="mx-auto mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No active network connection
                </p>
              </div>
            )}

            {/* Docker Network Stats */}
            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <Container className="size-3.5 text-primary" /> Container
                Network Activity
              </div>
              {daemonAvailable === false ? (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  Docker daemon unreachable
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-secondary/40 p-2 text-center">
                    <p className="text-xl font-mono text-foreground">
                      {(dockerTotals.totalNetworkRx / 1024 / 1024).toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">MB Received</p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-2 text-center">
                    <p className="text-xl font-mono text-foreground">
                      {(dockerTotals.totalNetworkTx / 1024 / 1024).toFixed(1)}
                    </p>
                    <p className="text-xs text-muted-foreground">MB Sent</p>
                  </div>
                </div>
              )}
            </div>

            {/* System Info */}
            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <Activity className="size-3.5 text-primary" /> System Info
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-secondary/40 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">Hostname</p>
                  <p className="text-sm font-mono text-foreground">
                    {systemMetrics?.hostname ?? "--"}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">Platform</p>
                  <p className="text-sm font-mono text-foreground">
                    {systemMetrics?.platform ?? "--"}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">Uptime</p>
                  <p className="text-sm font-mono text-foreground">
                    {systemMetrics?.uptimeSeconds
                      ? formatUptimeShort(systemMetrics.uptimeSeconds)
                      : "--"}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2">
                  <p className="mb-1 text-xs text-muted-foreground">
                    Containers
                  </p>
                  <p className="text-sm font-mono text-foreground">
                    {daemonAvailable === false
                      ? "unavailable"
                      : `${dockerStats.length} total`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
