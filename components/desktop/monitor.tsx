"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  Search,
} from "lucide-react"

type MonitorTab = "processes" | "resources" | "network"
type SortKey = "cpu" | "memory" | "network" | "disk"

type ProcessItem = {
  name: string
  status: "Running" | "Sleeping" | "Background"
  pid: number
  cpu: number
  memory: number
  network: number
  disk: number
}

const processSeed: ProcessItem[] = [
  { name: "Docker Engine", status: "Running", pid: 1221, cpu: 12.4, memory: 1810, network: 1.9, disk: 0.3 },
  { name: "Grafana", status: "Running", pid: 1874, cpu: 4.1, memory: 422, network: 0.8, disk: 0.2 },
  { name: "Plex Media Server", status: "Running", pid: 2131, cpu: 17.3, memory: 2630, network: 3.4, disk: 2.1 },
  { name: "Nextcloud", status: "Running", pid: 2318, cpu: 6.8, memory: 980, network: 1.2, disk: 0.6 },
  { name: "Home Assistant", status: "Sleeping", pid: 2592, cpu: 2.1, memory: 744, network: 0.3, disk: 0.1 },
  { name: "Pi-hole DNS", status: "Running", pid: 2820, cpu: 1.6, memory: 192, network: 0.9, disk: 0.1 },
  { name: "Uptime Kuma", status: "Background", pid: 3014, cpu: 0.9, memory: 214, network: 0.4, disk: 0.1 },
  { name: "Nginx Proxy", status: "Running", pid: 3367, cpu: 2.8, memory: 310, network: 1.1, disk: 0.2 },
  { name: "PostgreSQL", status: "Running", pid: 3599, cpu: 8.2, memory: 1268, network: 0.6, disk: 1.7 },
  { name: "Vaultwarden", status: "Running", pid: 4016, cpu: 1.4, memory: 280, network: 0.4, disk: 0.1 },
]

const interfaces = [
  { name: "enp3s0", ip: "192.168.1.100", down: "24.8 MB/s", up: "8.3 MB/s", status: "Connected" },
  { name: "docker0", ip: "172.17.0.1", down: "3.1 MB/s", up: "2.2 MB/s", status: "Connected" },
  { name: "wg0", ip: "10.0.0.1", down: "1.8 MB/s", up: "0.9 MB/s", status: "Connected" },
]

function nudge(value: number, min: number, max: number, delta = 2.2) {
  const next = value + (Math.random() * 2 - 1) * delta
  return Math.min(max, Math.max(min, Number(next.toFixed(1))))
}

function MetricCard({
  label,
  icon: Icon,
  value,
  sub,
  color,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string
  sub: string
  color: string
}) {
  return (
    <div className="rounded-xl border border-glass-border bg-glass p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`size-3.5 ${color}`} />
      </div>
      <div className="text-xl font-semibold text-foreground font-mono">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function HistoryBars({ values, color }: { values: number[]; color: string }) {
  return (
    <div className="flex h-16 items-end gap-1 rounded-xl border border-glass-border bg-glass p-2">
      {values.map((v, i) => (
        <span
          key={`${i}-${v}`}
          className={`w-1.5 rounded-sm ${color} transition-all duration-300`}
          style={{ height: `${Math.max(6, Math.round(v))}%` }}
        />
      ))}
    </div>
  )
}

export function Monitor() {
  const [tab, setTab] = useState<MonitorTab>("processes")
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortKey>("cpu")
  const [cpu, setCpu] = useState(21.8)
  const [memory, setMemory] = useState(34.1)
  const [disk, setDisk] = useState(47.2)
  const [download, setDownload] = useState(24.8)
  const [upload, setUpload] = useState(8.3)
  const [cpuHistory, setCpuHistory] = useState<number[]>([18, 21, 17, 24, 23, 20, 28, 26, 22, 19, 21, 25, 24, 20, 23, 22, 19, 26, 24, 21, 18, 22, 27, 24])
  const [memHistory, setMemHistory] = useState<number[]>([31, 33, 32, 34, 36, 35, 33, 32, 34, 35, 37, 36, 34, 33, 34, 35, 36, 35, 34, 33, 34, 35, 34, 33])
  const [processes, setProcesses] = useState<ProcessItem[]>(processSeed)

  useEffect(() => {
    const timer = setInterval(() => {
      setCpu((v) => nudge(v, 7, 72))
      setMemory((v) => nudge(v, 22, 79))
      setDisk((v) => nudge(v, 35, 91, 1.1))
      setDownload((v) => nudge(v, 3.5, 44, 3.4))
      setUpload((v) => nudge(v, 1.2, 21, 1.8))

      setCpuHistory((prev) => [...prev.slice(-23), nudge(prev[prev.length - 1] || 20, 8, 72)])
      setMemHistory((prev) => [...prev.slice(-23), nudge(prev[prev.length - 1] || 34, 22, 79, 1.7)])

      setProcesses((prev) =>
        prev.map((p) => ({
          ...p,
          cpu: nudge(p.cpu, 0.1, 28, 1.6),
          memory: nudge(p.memory, 140, 2900, 38),
          network: nudge(p.network, 0.1, 6.2, 0.5),
          disk: nudge(p.disk, 0.1, 4.8, 0.3),
        }))
      )
    }, 2200)

    return () => clearInterval(timer)
  }, [])

  const filteredProcesses = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q
      ? processes.filter((p) => p.name.toLowerCase().includes(q))
      : processes

    return [...filtered].sort((a, b) => b[sortBy] - a[sortBy])
  }, [processes, query, sortBy])

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
              className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition-all cursor-pointer ${
                tab === item.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search process..."
            className="w-full rounded-lg border border-glass-border bg-glass py-1.5 pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/40"
          />
        </div>
      </div>

      {tab === "processes" && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-3 grid grid-cols-5 gap-2">
            <MetricCard label="CPU Load" icon={Cpu} value={`${cpu}%`} sub="16 threads" color="text-primary" />
            <MetricCard label="Memory" icon={MemoryStick} value={`${memory}%`} sub="5.4 / 16 GB" color="text-chart-2" />
            <MetricCard label="Disk IO" icon={HardDrive} value={`${disk}%`} sub="1.9 TB used" color="text-chart-4" />
            <MetricCard label="Download" icon={ArrowDown} value={`${download} MB/s`} sub="enp3s0" color="text-status-green" />
            <MetricCard label="Upload" icon={ArrowUp} value={`${upload} MB/s`} sub="enp3s0" color="text-sky-400" />
          </div>

          <div className="overflow-hidden rounded-xl border border-glass-border bg-glass">
            <div className="grid grid-cols-[2.2fr_0.8fr_1fr_1fr_1fr_1fr] gap-2 border-b border-glass-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Process</span>
              <span>Status</span>
              <button onClick={() => setSortBy("cpu")} className="cursor-pointer text-left hover:text-foreground">CPU %</button>
              <button onClick={() => setSortBy("memory")} className="cursor-pointer text-left hover:text-foreground">Memory MB</button>
              <button onClick={() => setSortBy("network")} className="cursor-pointer text-left hover:text-foreground">Net MB/s</button>
              <button onClick={() => setSortBy("disk")} className="cursor-pointer text-left hover:text-foreground">Disk MB/s</button>
            </div>

            {filteredProcesses.map((p) => (
              <div
                key={`${p.name}-${p.pid}`}
                className="grid grid-cols-[2.2fr_0.8fr_1fr_1fr_1fr_1fr] gap-2 border-b border-glass-border/60 px-3 py-2.5 text-xs last:border-none hover:bg-secondary/35"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary/60 text-[11px] font-semibold text-foreground">
                    {p.name[0]}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">PID {p.pid}</p>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="rounded-full bg-status-green/15 px-2 py-0.5 text-[10px] text-status-green">{p.status}</span>
                </div>
                <span className="font-mono text-foreground">{p.cpu.toFixed(1)}</span>
                <span className="font-mono text-foreground">{Math.round(p.memory)}</span>
                <span className="font-mono text-foreground">{p.network.toFixed(1)}</span>
                <span className="font-mono text-foreground">{p.disk.toFixed(1)}</span>
              </div>
            ))}
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
              <p className="mt-2 text-[11px] text-muted-foreground">Current {cpu}% | Peak 72%</p>
            </div>

            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <MemoryStick className="size-3.5 text-chart-2" /> Memory Pressure
              </div>
              <HistoryBars values={memHistory} color="bg-chart-2/85" />
              <p className="mt-2 text-[11px] text-muted-foreground">Current {memory}% | Cached 4.1 GB</p>
            </div>

            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <HardDrive className="size-3.5 text-chart-4" /> Disk Usage
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
                <div className="h-full bg-chart-4 transition-all duration-300" style={{ width: `${disk}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>2.64 TB / 5.64 TB</span>
                <span className="font-mono">{disk}%</span>
              </div>
            </div>

            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <Gauge className="size-3.5 text-status-amber" /> Load Average
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {["0.42", "0.38", "0.35"].map((v, i) => (
                  <div key={v} className="rounded-lg bg-secondary/40 py-2">
                    <p className="text-sm font-mono text-foreground">{v}</p>
                    <p className="text-[10px] text-muted-foreground">{i === 0 ? "1m" : i === 1 ? "5m" : "15m"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "network" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            {interfaces.map((net) => (
              <div key={net.name} className="rounded-xl border border-glass-border bg-glass p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Network className="size-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{net.name}</p>
                      <p className="text-[11px] text-muted-foreground">{net.ip}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-status-green/15 px-2 py-0.5 text-[10px] text-status-green">
                    {net.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <ArrowDown className="size-3 text-status-green" /> Receive
                    </p>
                    <p className="text-sm font-mono text-foreground">{net.down}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 p-2">
                    <p className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <ArrowUp className="size-3 text-sky-400" /> Transmit
                    </p>
                    <p className="text-sm font-mono text-foreground">{net.up}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-glass-border bg-glass p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
                <Activity className="size-3.5 text-primary" /> Active Connections
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg bg-secondary/40 p-2 text-center">
                  <p className="text-xl font-mono text-foreground">148</p>
                  <p className="text-[10px] text-muted-foreground">ESTABLISHED</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2 text-center">
                  <p className="text-xl font-mono text-foreground">12</p>
                  <p className="text-[10px] text-muted-foreground">LISTEN</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2 text-center">
                  <p className="text-xl font-mono text-foreground">4</p>
                  <p className="text-[10px] text-muted-foreground">TIME_WAIT</p>
                </div>
                <div className="rounded-lg bg-secondary/40 p-2 text-center">
                  <p className="text-xl font-mono text-foreground">2.4ms</p>
                  <p className="text-[10px] text-muted-foreground">LATENCY</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
