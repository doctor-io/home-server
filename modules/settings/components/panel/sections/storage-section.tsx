import {
    InfoBanner,
    SectionDivider,
    StorageBar,
    formatStorageSize,
} from "@/modules/settings/components/panel/controls";
import {
  SETTINGS_BADGE_SURFACE,
  SETTINGS_PANEL_INSET,
} from "@/modules/settings/components/panel/surface";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";
import { HardDrive, Thermometer } from "@/components/icons/platform-icons";

type StorageSectionProps = {
  data: SettingsBackend["storage"];
};

export function StorageSection({ data }: StorageSectionProps) {
  const rootUsedPercent =
    data.usedPercent !== null && data.usedPercent !== undefined
      ? Number(data.usedPercent.toFixed(1))
      : 0;
  const diskColors = [
    "oklch(0.72 0.14 190)",
    "oklch(0.65 0.15 160)",
    "oklch(0.78 0.12 85)",
    "oklch(0.6 0.2 340)",
  ];
  const smartCheckedLabel = data.smart?.checkedAt
    ? new Date(data.smart.checkedAt).toLocaleString()
    : null;
  const smartData = data.smart;

  return (
    <div className="flex flex-col gap-1">
      {data.warning ? (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      ) : null}
      <SectionDivider title="Files Root Usage" />
      <StorageBar
        label={`${data.mountPath} (FILES_ROOT)`}
        detail={
          data.summary !== "--"
            ? `${data.summary} (${Math.round(rootUsedPercent)}%)`
            : "Usage unavailable"
        }
        pct={rootUsedPercent}
        color="oklch(0.72 0.14 190)"
      />
      <div className="grid grid-cols-3 gap-4 text-xs py-2">
        <div>
          <span className="text-xs text-muted-foreground block">Used</span>
          <span className="text-foreground">
            {formatStorageSize(data.usedBytes)}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Available</span>
          <span className="text-foreground">
            {formatStorageSize(data.availableBytes)}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">Total</span>
          <span className="text-foreground">
            {formatStorageSize(data.totalBytes)}
          </span>
        </div>
      </div>

      <SectionDivider title="Disks" />
      {data.disks.length === 0 ? (
        <div className="py-2 text-xs text-muted-foreground">
          No disk metrics available.
        </div>
      ) : (
        data.disks.map((disk, index) => (
          <StorageBar
            key={disk.id}
            label={disk.label}
            detail={`${formatStorageSize(disk.usedBytes)} / ${formatStorageSize(disk.totalBytes)} (${Math.round(disk.usedPercent)}%)`}
            pct={disk.usedPercent}
            color={diskColors[index % diskColors.length]}
          />
        ))
      )}

      <SectionDivider title="RAID Configuration" />
      {data.raid ? (
        <div className={`${SETTINGS_PANEL_INSET} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              Pool: {data.raid.name}
            </span>
            <span
              className={`${SETTINGS_BADGE_SURFACE} px-2 py-0.5 text-xs font-medium ${
                data.raid.status === "healthy"
                  ? "bg-status-green/15 text-status-green"
                  : data.raid.status === "degraded"
                    ? "bg-status-amber/15 text-status-amber"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {data.raid.status}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="block text-xs text-muted-foreground">Type</span>
              <span className="text-foreground">{data.raid.type}</span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">
                Total Size
              </span>
              <span className="text-foreground">
                {formatStorageSize(data.raid.totalBytes)}
              </span>
            </div>
            <div>
              <span className="block text-xs text-muted-foreground">
                Redundancy
              </span>
              <span className="text-foreground">
                {data.raid.redundancy ?? "Not reported"}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className={`${SETTINGS_PANEL_INSET} px-3 py-3 text-xs text-muted-foreground`}>
          No RAID pool detected on this host.
        </div>
      )}

      <SectionDivider title="Shared Folders" />
      <div className="flex items-center justify-between text-xs text-muted-foreground py-1">
        <span>Local shares: {data.localShareCount}</span>
        <span>Network shares: {data.networkShareCount}</span>
      </div>
      <div className={`${SETTINGS_PANEL_INSET} overflow-hidden`}>
        {data.shares.length === 0 ? (
          <div className="px-3 py-3 text-xs text-muted-foreground">
            No shared folders configured.
          </div>
        ) : (
          data.shares.map((share, index) => (
            <div
              key={share.id}
              className={`flex items-center justify-between px-3 py-2.5 text-xs ${
                index < data.shares.length - 1
                  ? "border-b border-glass-border"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2.5">
                <HardDrive className="size-3.5 text-primary" />
                <div className="flex flex-col">
                  <span className="text-foreground font-medium">
                    {share.name}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {share.path}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground">{share.protocol}</span>
                <span
                  className={
                    share.status === "Mounted"
                      ? "text-status-green"
                      : share.status === "Partially configured"
                        ? "text-status-amber"
                        : "text-muted-foreground"
                  }
                >
                  {share.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <SectionDivider title="S.M.A.R.T. Health" />
      <InfoBanner
        text={
          smartData
            ? `${smartData.message}${smartCheckedLabel ? ` Last checked: ${smartCheckedLabel}.` : ""}`
            : "S.M.A.R.T. status unavailable on this host."
        }
        variant={smartData?.status === "degraded" ? "warning" : "info"}
      />
      {smartData && smartData.disks.length > 0 ? (
        <div className={`${SETTINGS_PANEL_INSET} overflow-hidden`}>
          {smartData.disks.map((disk, index) => (
            <div
              key={disk.device}
              className={`flex items-center justify-between px-3 py-2.5 ${
                index < smartData.disks.length - 1
                  ? "border-b border-glass-border"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <HardDrive className="size-3.5 shrink-0 text-primary" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-foreground font-mono truncate">
                    {disk.device}
                  </span>
                  {disk.name ? (
                    <span className="text-xs text-muted-foreground truncate">
                      {disk.name}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                {disk.type ? (
                  <span className="text-xs text-muted-foreground">
                    {disk.type}
                  </span>
                ) : null}
                {disk.sizeBytes !== null ? (
                  <span className="text-xs text-muted-foreground">
                    {formatStorageSize(disk.sizeBytes)}
                  </span>
                ) : null}
                {disk.temperatureCelsius !== null ? (
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Thermometer className="size-3" />
                    {disk.temperatureCelsius}°C
                  </span>
                ) : null}
                {disk.powerOnHours !== null ? (
                  <span className="text-xs text-muted-foreground">
                    {disk.powerOnHours >= 8_760
                      ? `${(disk.powerOnHours / 8_760).toFixed(1)}yr`
                      : disk.powerOnHours >= 24
                        ? `${Math.floor(disk.powerOnHours / 24)}d`
                        : `${disk.powerOnHours}h`}
                  </span>
                ) : null}
                <span
                  className={`${SETTINGS_BADGE_SURFACE} px-2 py-0.5 text-xs font-medium ${
                    disk.status === "healthy"
                      ? "bg-status-green/15 text-status-green"
                      : disk.status === "degraded"
                        ? "bg-status-red/15 text-status-red"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {disk.smartStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
