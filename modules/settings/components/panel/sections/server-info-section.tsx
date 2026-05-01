"use client";

import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import { useServerInfo } from "@/modules/system/hooks/useServerInfo";
import { cn } from "@/lib/utils";
import type { ServerHardwareInfo } from "@/lib/shared/contracts/server-info";
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

type TabId = "os" | "cpu" | "memory" | "gpu" | "battery" | "firmware";

export function ServerInfoSection() {
  const { data: info, isLoading, isError } = useServerInfo();
  const [activeTab, setActiveTab] = useState<TabId>("os");

  const tabs: { id: TabId; label: string; hidden?: boolean }[] = [
    { id: "os", label: "OS" },
    { id: "cpu", label: "CPU" },
    { id: "memory", label: "Memory" },
    { id: "gpu", label: "GPU" },
    { id: "battery", label: "Battery", hidden: !info?.battery.hasBattery },
    { id: "firmware", label: "Firmware", hidden: !info?.bios.vendor && !info?.baseboard.manufacturer },
  ];

  const visibleTabs = tabs.filter((t) => !t.hidden);

  const safeTab = visibleTabs.find((t) => t.id === activeTab) ? activeTab : visibleTabs[0]?.id ?? "os";

  return (
    <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-glass-border/50 px-2 py-2">
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
        {info && safeTab === "os" && <OsTab info={info} />}
        {info && safeTab === "cpu" && <CpuTab info={info} />}
        {info && safeTab === "memory" && <MemoryTab info={info} />}
        {info && safeTab === "gpu" && <GpuTab info={info} />}
        {info && safeTab === "battery" && <BatteryTab info={info} />}
        {info && safeTab === "firmware" && <FirmwareTab info={info} />}
      </div>
    </div>
  );
}
