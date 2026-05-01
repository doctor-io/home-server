"use client";

import {
  InfoBanner,
  SectionDivider,
  formatStorageSize,
} from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";
import { HardDrive, Thermometer } from "@/components/icons/platform-icons";
import { HardDriveRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { cn } from "@/lib/utils";

type StorageSectionProps = {
  data: SettingsBackend["storage"];
  onOpenDiskManager?: () => void;
};

const DISK_COLORS = [
  "oklch(0.72 0.14 190)",
  "oklch(0.65 0.15 160)",
  "oklch(0.78 0.12 85)",
  "oklch(0.6 0.2 340)",
];

function UsageBar({ pct, color }: { pct: number; color: string }) {
  const safe = Math.max(0, Math.min(pct, 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-background/65">
      <div className="h-full rounded-full transition-all" style={{ width: `${safe}%`, backgroundColor: color }} />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return (
    <div className={cn(
      "size-2 shrink-0 rounded-full",
      status === "healthy" ? "bg-status-green" : status === "degraded" ? "bg-status-amber" : "bg-muted-foreground/40",
    )} />
  );
}

export function StorageSection({ data, onOpenDiskManager }: StorageSectionProps) {
  const rootUsedPct = data.usedPercent != null ? Number(data.usedPercent.toFixed(1)) : 0;
  const smartData = data.smart;
  const smartCheckedLabel = smartData?.checkedAt
    ? new Date(smartData.checkedAt).toLocaleString()
    : null;

  return (
    <div className="flex flex-col gap-1">
      {data.warning && (
        <InfoBanner text={data.warning} variant={data.unavailable ? "warning" : "info"} />
      )}

      {/* ── Disk Manager shortcut ── */}
      {onOpenDiskManager && (
        <button
          onClick={onOpenDiskManager}
          className={cn(
            SETTINGS_PANEL_INSET,
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-background/60",
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
            <HardDriveRegular className="size-4 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Disk & Partition Manager</p>
            <p className="text-[11px] text-muted-foreground/70">
              Format, mount, and manage partitions
            </p>
          </div>
          <ChevronRightRegular className="size-4 text-muted-foreground/40" />
        </button>
      )}

      {/* ── Files root ── */}
      <SectionDivider title="Files Root" />
      <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-3")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{data.mountPath}</span>
          <span className="text-xs font-medium text-foreground">
            {data.summary !== "--" ? `${data.summary} · ${Math.round(rootUsedPct)}%` : "Unavailable"}
          </span>
        </div>
        <UsageBar pct={rootUsedPct} color={DISK_COLORS[0]!} />
        <div className="mt-3 flex gap-6">
          {[
            { label: "Used", value: formatStorageSize(data.usedBytes) },
            { label: "Available", value: formatStorageSize(data.availableBytes) },
            { label: "Total", value: formatStorageSize(data.totalBytes) },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">{label}</div>
              <div className="mt-0.5 text-xs font-medium text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Disks ── */}
      <SectionDivider title="Disks" />
      {data.disks.length === 0 ? (
        <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-3 text-xs text-muted-foreground")}>
          No disk metrics available.
        </div>
      ) : (
        <div className={cn(SETTINGS_PANEL_INSET, "divide-y divide-glass-border/50 px-4")}>
          {data.disks.map((disk, i) => (
            <div key={disk.id} className="py-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{disk.label}</span>
                <span className="text-xs text-muted-foreground">
                  {formatStorageSize(disk.usedBytes)} / {formatStorageSize(disk.totalBytes)} · {Math.round(disk.usedPercent)}%
                </span>
              </div>
              <UsageBar pct={disk.usedPercent} color={DISK_COLORS[i % DISK_COLORS.length]!} />
            </div>
          ))}
        </div>
      )}

      {/* ── RAID ── */}
      <SectionDivider title="RAID" />
      {data.raid ? (
        <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <StatusDot status={data.raid.status} />
              <span className="text-sm font-medium text-foreground">{data.raid.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{data.raid.type}</span>
          </div>
          <div className="divide-y divide-glass-border/50 border-t border-glass-border/50 px-4">
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-muted-foreground">Status</span>
              <span className={cn(
                "text-xs font-medium",
                data.raid.status === "healthy" ? "text-status-green" : data.raid.status === "degraded" ? "text-status-amber" : "text-muted-foreground",
              )}>
                {data.raid.status}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-muted-foreground">Total size</span>
              <span className="text-xs font-medium text-foreground">{formatStorageSize(data.raid.totalBytes)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs text-muted-foreground">Redundancy</span>
              <span className="text-xs font-medium text-foreground">{data.raid.redundancy ?? "Not reported"}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-3 text-xs text-muted-foreground")}>
          No RAID pool detected on this host.
        </div>
      )}

      {/* ── Shared Folders ── */}
      <SectionDivider title="Shared Folders" />
      <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
        {data.shares.length === 0 ? (
          <div className="px-4 py-3 text-xs text-muted-foreground">No shared folders configured.</div>
        ) : (
          <div className="divide-y divide-glass-border/50">
            {data.shares.map((share) => (
              <div key={share.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                  <HardDrive className="size-3.5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground">{share.name}</div>
                  <div className="font-mono text-[11px] text-muted-foreground/70">{share.path}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{share.protocol}</span>
                  <div className={cn(
                    "size-1.5 rounded-full",
                    share.status === "Mounted" ? "bg-status-green" : share.status === "Partially configured" ? "bg-status-amber" : "bg-muted-foreground/40",
                  )} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t border-glass-border/50 px-4 py-2">
          <span className="text-[11px] text-muted-foreground/60">{data.localShareCount} local · {data.networkShareCount} network</span>
        </div>
      </div>

      {/* ── S.M.A.R.T. ── */}
      <SectionDivider title="S.M.A.R.T. Health" />
      {!smartData ? (
        <div className={cn(SETTINGS_PANEL_INSET, "px-4 py-3 text-xs text-muted-foreground")}>
          S.M.A.R.T. status unavailable on this host.
        </div>
      ) : (
        <div className={cn(SETTINGS_PANEL_INSET, "overflow-hidden")}>
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5">
              <StatusDot status={smartData.status} />
              <span className="text-sm font-medium text-foreground">{smartData.message}</span>
            </div>
            {smartCheckedLabel && (
              <span className="text-[11px] text-muted-foreground/60">{smartCheckedLabel}</span>
            )}
          </div>
          {smartData.disks.length > 0 && (
            <div className="divide-y divide-glass-border/50 border-t border-glass-border/50">
              {smartData.disks.map((disk) => (
                <div key={disk.device} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                    <HardDrive className="size-3.5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-medium text-foreground">{disk.device}</div>
                    {disk.name && <div className="text-[11px] text-muted-foreground/70">{disk.name}</div>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                    {disk.type && <span>{disk.type}</span>}
                    {disk.sizeBytes != null && <span>{formatStorageSize(disk.sizeBytes)}</span>}
                    {disk.temperatureCelsius != null && (
                      <span className="flex items-center gap-0.5">
                        <Thermometer className="size-3" />{disk.temperatureCelsius}°C
                      </span>
                    )}
                    {disk.powerOnHours != null && (
                      <span>
                        {disk.powerOnHours >= 8_760
                          ? `${(disk.powerOnHours / 8_760).toFixed(1)}yr`
                          : disk.powerOnHours >= 24
                            ? `${Math.floor(disk.powerOnHours / 24)}d`
                            : `${disk.powerOnHours}h`}
                      </span>
                    )}
                    <div className={cn(
                      "size-1.5 rounded-full",
                      disk.status === "healthy" ? "bg-status-green" : disk.status === "degraded" ? "bg-status-red" : "bg-muted-foreground/40",
                    )} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
