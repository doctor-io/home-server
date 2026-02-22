"use client"

import { useEffect, useState } from "react"
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Thermometer,
  ArrowDown,
  ArrowUp,
  Activity,
  Clock,
} from "lucide-react"

function AnimatedProgress({
  value,
  color,
}: {
  value: number
  color: string
}) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 100)
    return () => clearTimeout(timer)
  }, [value])

  return (
    <div className="w-full h-1.5 rounded-full bg-secondary/60 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

export function SystemWidgets() {
  const [uptime, setUptime] = useState({ days: 14, hours: 7, minutes: 23 })

  useEffect(() => {
    const timer = setInterval(() => {
      setUptime((prev) => {
        let { days, hours, minutes } = prev
        minutes += 1
        if (minutes >= 60) {
          minutes = 0
          hours += 1
        }
        if (hours >= 24) {
          hours = 0
          days += 1
        }
        return { days, hours, minutes }
      })
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <aside className="hidden xl:flex flex-col gap-3 w-72 pr-6 pt-4 pb-6 flex-shrink-0">
      {/* Uptime Widget */}
      <div className="rounded-2xl bg-glass border border-glass-border backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="size-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Uptime
          </h3>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-foreground font-mono">
            {uptime.days}
          </span>
          <span className="text-xs text-muted-foreground mr-2">days</span>
          <span className="text-2xl font-bold text-foreground font-mono">
            {uptime.hours}
          </span>
          <span className="text-xs text-muted-foreground mr-2">hrs</span>
          <span className="text-2xl font-bold text-foreground font-mono">
            {uptime.minutes}
          </span>
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      </div>

      {/* Resource Monitor */}
      <div className="rounded-2xl bg-glass border border-glass-border backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="size-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Resources
          </h3>
        </div>
        <div className="flex flex-col gap-4">
          <ResourceItem
            icon={Cpu}
            label="CPU"
            value="12%"
            progress={12}
            color="bg-primary"
          />
          <ResourceItem
            icon={MemoryStick}
            label="Memory"
            value="4.2 / 16 GB"
            progress={26}
            color="bg-chart-2"
          />
          <ResourceItem
            icon={HardDrive}
            label="Storage"
            value="1.8 / 4 TB"
            progress={45}
            color="bg-chart-4"
          />
          <ResourceItem
            icon={Thermometer}
            label="Temperature"
            value="42 C"
            progress={42}
            color="bg-status-amber"
          />
        </div>
      </div>

      {/* Network Widget */}
      <div className="rounded-2xl bg-glass border border-glass-border backdrop-blur-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="size-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Network
          </h3>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowDown className="size-3.5 text-status-green" />
              <span className="text-xs text-muted-foreground">Download</span>
            </div>
            <span className="text-sm font-mono font-medium text-foreground">
              24.8 MB/s
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowUp className="size-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Upload</span>
            </div>
            <span className="text-sm font-mono font-medium text-foreground">
              8.3 MB/s
            </span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Local IP</span>
            <span className="text-xs font-mono text-foreground">
              192.168.1.100
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Hostname</span>
            <span className="text-xs font-mono text-foreground">
              serverlab.local
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-2xl bg-glass border border-glass-border backdrop-blur-xl p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="Containers" value="17" sub="running" />
          <StatBox label="Services" value="20" sub="total" />
          <StatBox label="DNS Blocked" value="34%" sub="today" />
          <StatBox label="Updates" value="2" sub="available" />
        </div>
      </div>
    </aside>
  )
}

function ResourceItem({
  icon: Icon,
  label,
  value,
  progress,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  progress: number
  color: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <span className="text-xs font-mono font-medium text-foreground">
          {value}
        </span>
      </div>
      <AnimatedProgress value={progress} color={color} />
    </div>
  )
}

function StatBox({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 py-2 rounded-xl bg-glass-highlight">
      <span className="text-lg font-bold text-foreground font-mono">
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[9px] text-muted-foreground/70">{sub}</span>
    </div>
  )
}
