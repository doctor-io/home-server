"use client";

import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { useServerInfo } from "@/modules/system/hooks/useServerInfo";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
import { cn } from "@/lib/utils";
import type { ServerHardwareInfo } from "@/lib/shared/contracts/server-info";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import { useState } from "react";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function Row({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className={cn("max-w-[60%] break-all text-right text-xs font-medium text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function Rows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-glass-border/40 px-4">{children}</div>;
}

function OsTab({ info }: { info: ServerHardwareInfo }) {
  const { os, system } = info;
  return (
    <Rows>
      <Row label="Hostname" value={os.hostname} />
      <Row label="OS" value={[os.distro, os.release].filter(Boolean).join(" ") || os.platform} />
      <Row label="Codename" value={os.codename} />
      <Row label="Kernel" value={os.kernel} mono />
      <Row label="Architecture" value={os.arch} />
      {system.manufacturer && system.model && (
        <Row label="System" value={[system.manufacturer, system.model, system.version].filter(Boolean).join(" ")} />
      )}
      <Row label="Serial" value={system.serial} mono />
      <Row label="UUID" value={system.uuid} mono />
    </Rows>
  );
}

function CpuTab({ info }: { info: ServerHardwareInfo }) {
  const { cpu } = info;
  const name = [cpu.manufacturer, cpu.brand].filter(Boolean).join(" ") || null;
  const coreInfo = cpu.physicalCores && cpu.cores
    ? `${cpu.physicalCores} physical · ${cpu.cores} logical`
    : cpu.cores ? `${cpu.cores} logical` : null;
  const speedInfo = cpu.maxSpeedGhz
    ? `${cpu.speedGhz ?? "?"} GHz (max ${cpu.maxSpeedGhz} GHz)`
    : cpu.speedGhz ? `${cpu.speedGhz} GHz` : null;

  return (
    <Rows>
      <Row label="Model" value={name} />
      <Row label="Cores" value={coreInfo} />
      {cpu.processors && cpu.processors > 1 && <Row label="Sockets" value={String(cpu.processors)} />}
      <Row label="Speed" value={speedInfo} />
      <Row label="Socket" value={cpu.socket} />
      <Row label="Governor" value={cpu.governor} />
    </Rows>
  );
}

function MemoryTab({ info }: { info: ServerHardwareInfo }) {
  const { memory } = info;
  const filledSlots = memory.slots.filter((s) => s.sizeBytes && s.sizeBytes > 0);

  return (
    <div>
      <Rows>
        <Row label="Total" value={formatBytes(memory.totalBytes)} />
        {filledSlots.length > 0 && <Row label="Modules" value={`${filledSlots.length} installed`} />}
      </Rows>

      {filledSlots.length > 0 && (
        <>
          <div className="border-t border-glass-border/40 px-4 pb-1 pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">Slots</span>
          </div>
          <div className="divide-y divide-glass-border/30 px-4">
            {filledSlots.map((slot, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-2.5">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{slot.bank ?? `Slot ${i + 1}`}</span>
                <div className="text-right">
                  <div className="text-xs font-medium text-foreground">{formatBytes(slot.sizeBytes)}</div>
                  {slot.manufacturer && <div className="text-[11px] text-muted-foreground/60">{slot.manufacturer}</div>}
                  <div className="text-[11px] text-muted-foreground/50">
                    {[slot.type, slot.formFactor, slot.clockSpeedMhz ? `${slot.clockSpeedMhz} MHz` : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GpuTab({ info }: { info: ServerHardwareInfo }) {
  const { controllers } = info.gpu;
  if (controllers.length === 0) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">No GPU detected.</div>;
  }
  return (
    <div className="divide-y divide-glass-border/40 px-4">
      {controllers.map((ctrl, i) => {
        const name = [ctrl.vendor, ctrl.model].filter(Boolean).join(" ") || `GPU ${i + 1}`;
        return (
          <div key={i} className="py-3">
            <div className="mb-1 text-xs font-medium text-foreground">{name}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
              {ctrl.bus && <span className="text-[11px] text-muted-foreground/70">{ctrl.bus}</span>}
              {ctrl.vramBytes && <span className="text-[11px] text-muted-foreground/70">VRAM {formatBytes(ctrl.vramBytes)}</span>}
              {ctrl.subVendor && <span className="text-[11px] text-muted-foreground/70">{ctrl.subVendor}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ThermalTab({ metrics }: { metrics: SystemMetricsSnapshot | undefined }) {
  const temp = metrics?.temperature;

  if (!metrics) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">Loading temperature data…</div>;
  }

  const main = temp?.mainCelsius;
  const max = temp?.maxCelsius;
  const cores = temp?.coresCelsius ?? [];

  if (main === null && cores.length === 0) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">Temperature sensors not available on this host.</div>;
  }

  function tempColor(c: number) {
    if (c >= 85) return "text-status-red";
    if (c >= 70) return "text-status-amber";
    return "text-status-green";
  }

  function tempBarColor(c: number) {
    if (c >= 85) return "bg-status-red";
    if (c >= 70) return "bg-status-amber";
    return "bg-status-green";
  }

  return (
    <div>
      {/* Summary row */}
      <div className="flex gap-6 border-b border-glass-border/40 px-4 py-3">
        {main != null && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">CPU</div>
            <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", tempColor(main))}>{main}°C</div>
          </div>
        )}
        {max != null && (
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">Max</div>
            <div className={cn("mt-0.5 text-lg font-semibold tabular-nums", tempColor(max))}>{max}°C</div>
          </div>
        )}
      </div>

      {/* Per-core grid */}
      {cores.length > 0 && (
        <div className="px-4 pb-3 pt-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
            Cores
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
            {cores.map((c, i) => (
              <div key={i}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground/70">Core {i}</span>
                  <span className={cn("text-[11px] font-medium tabular-nums", tempColor(c))}>{c}°C</span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-background/50">
                  <div
                    className={cn("h-full rounded-full transition-all", tempBarColor(c))}
                    style={{ width: `${Math.min((c / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NetworkTab({ info }: { info: ServerHardwareInfo }) {
  const { interfaces } = info.network;

  if (interfaces.length === 0) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">No network interfaces found.</div>;
  }

  return (
    <div className="divide-y divide-glass-border/40 px-4">
      {interfaces.map((iface, i) => (
        <div key={i} className="py-3">
          {/* Header row */}
          <div className="mb-2 flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-foreground">{iface.iface}</span>
            {iface.type && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-background/60 text-muted-foreground/70">
                {iface.type}
              </span>
            )}
            {iface.isDefault && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-primary/15 text-primary">
                default
              </span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <div className={cn(
                "size-1.5 rounded-full",
                iface.operstate === "up" ? "bg-status-green" : iface.operstate === "down" ? "bg-status-red" : "bg-muted-foreground/30",
              )} />
              <span className="text-[11px] text-muted-foreground/60">{iface.operstate ?? "unknown"}</span>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-0.5">
            {iface.ip4 && (
              <div className="flex justify-between gap-4">
                <span className="text-[11px] text-muted-foreground/60">IPv4</span>
                <span className="font-mono text-[11px] text-foreground/80">
                  {iface.ip4}{iface.ip4subnet ? `/${iface.ip4subnet}` : ""}
                </span>
              </div>
            )}
            {iface.ip6 && (
              <div className="flex justify-between gap-4">
                <span className="shrink-0 text-[11px] text-muted-foreground/60">IPv6</span>
                <span className="max-w-[70%] break-all font-mono text-[11px] text-foreground/80">{iface.ip6}</span>
              </div>
            )}
            {iface.mac && (
              <div className="flex justify-between gap-4">
                <span className="text-[11px] text-muted-foreground/60">MAC</span>
                <span className="font-mono text-[11px] text-foreground/80">{iface.mac}</span>
              </div>
            )}
            <div className="flex gap-4">
              {iface.speedMbps && (
                <span className="text-[11px] text-muted-foreground/60">{iface.speedMbps} Mbps</span>
              )}
              {iface.duplex && (
                <span className="text-[11px] text-muted-foreground/60">{iface.duplex} duplex</span>
              )}
              {iface.dhcp && (
                <span className="text-[11px] text-muted-foreground/60">DHCP</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FirmwareTab({ info }: { info: ServerHardwareInfo }) {
  const { bios, baseboard } = info;
  return (
    <Rows>
      {baseboard.manufacturer && baseboard.model && (
        <Row label="Motherboard" value={[baseboard.manufacturer, baseboard.model, baseboard.version].filter(Boolean).join(" ")} />
      )}
      <Row label="BIOS Vendor" value={bios.vendor} />
      <Row label="BIOS Version" value={bios.version} mono />
      <Row label="BIOS Date" value={bios.releaseDate} />
    </Rows>
  );
}

function BatteryTab({ info }: { info: ServerHardwareInfo }) {
  const { battery } = info;
  return (
    <Rows>
      <Row label="Manufacturer" value={battery.manufacturer} />
      <Row label="Designed Capacity" value={battery.designedCapacityWh ? `${battery.designedCapacityWh} Wh` : null} />
      <Row label="Max Capacity" value={battery.maxCapacityWh ? `${battery.maxCapacityWh} Wh` : null} />
      <Row label="Cycle Count" value={battery.cycleCount != null ? String(battery.cycleCount) : null} />
    </Rows>
  );
}

function SkeletonTab() {
  return (
    <div className="space-y-2.5 px-4 py-3">
      {[80, 60, 90, 50].map((w, i) => (
        <div key={i} className="flex justify-between">
          <div className="h-3 w-20 animate-pulse rounded bg-muted-foreground/15" />
          <div className="h-3 animate-pulse rounded bg-muted-foreground/10" style={{ width: `${w}px` }} />
        </div>
      ))}
    </div>
  );
}

type TabId = "os" | "cpu" | "memory" | "gpu" | "thermal" | "network" | "battery" | "firmware";

export function ServerInfoSection() {
  const { data: info, isLoading, isError } = useServerInfo();
  const { data: metrics } = useSystemMetrics();
  const [activeTab, setActiveTab] = useState<TabId>("os");

  const tabs: { id: TabId; label: string; hidden?: boolean }[] = [
    { id: "os",       label: "OS" },
    { id: "cpu",      label: "CPU" },
    { id: "memory",   label: "Memory" },
    { id: "gpu",      label: "GPU" },
    { id: "thermal",  label: "Thermal" },
    { id: "network",  label: "Network" },
    { id: "battery",  label: "Battery",  hidden: !info?.battery.hasBattery },
    { id: "firmware", label: "Firmware", hidden: !info?.bios.vendor && !info?.baseboard.manufacturer },
  ];

  const visibleTabs = tabs.filter((t) => !t.hidden);
  const safeTab = visibleTabs.find((t) => t.id === activeTab) ? activeTab : (visibleTabs[0]?.id ?? "os");

  return (
    <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-glass-border/50 px-2 py-2">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              safeTab === tab.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
        {info && (
          <span className="ml-auto text-[10px] text-muted-foreground/40">
            {new Date(info.fetchedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Tab content */}
      <div className="py-1">
        {isLoading && <SkeletonTab />}
        {isError && (
          <div className="px-4 py-3 text-xs text-muted-foreground">Failed to load hardware information.</div>
        )}
        {info && safeTab === "os"       && <OsTab info={info} />}
        {info && safeTab === "cpu"      && <CpuTab info={info} />}
        {info && safeTab === "memory"   && <MemoryTab info={info} />}
        {info && safeTab === "gpu"      && <GpuTab info={info} />}
        {         safeTab === "thermal" && <ThermalTab metrics={metrics} />}
        {info && safeTab === "network"  && <NetworkTab info={info} />}
        {info && safeTab === "battery"  && <BatteryTab info={info} />}
        {info && safeTab === "firmware" && <FirmwareTab info={info} />}
      </div>
    </div>
  );
}
