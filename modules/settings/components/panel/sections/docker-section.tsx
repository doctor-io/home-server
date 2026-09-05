"use client";

import { InfoBanner, SectionDivider } from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";
import { cn } from "@/lib/utils";

type DockerSectionProps = {
  data: SettingsBackend["docker"];
  capabilities: SettingsBackend["capabilities"]["docker"];
  onPruneImages: () => Promise<void>;
  onPruneVolumes: () => Promise<void>;
};

function StatCard({ label, value, valueClass }: { label: string; value: number | string; valueClass?: string }) {
  return (
    <div className={cn(SETTINGS_PANEL_INSET, "flex flex-col items-center justify-center gap-1 py-3")}>
      <span className={cn("text-2xl font-bold tabular-nums", valueClass ?? "text-foreground")}>{value}</span>
      <span className="text-2xs text-muted-foreground">{label}</span>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-medium text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function MaintenanceRow({
  label,
  description,
  pending,
  disabled,
  disabledReason,
  onClick,
}: {
  label: string;
  description: string;
  pending: boolean;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  return (
    <div className={cn(SETTINGS_PANEL_INSET, "flex items-center justify-between gap-4 px-4 py-3")}>
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        <div className="mt-0.5 text-2xs text-muted-foreground/70">{description}</div>
      </div>
      <button
        onClick={onClick}
        disabled={disabled || pending}
        title={disabledReason}
        className="shrink-0 rounded-lg border border-glass-border bg-background/55 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Running…" : "Run"}
      </button>
    </div>
  );
}

export function DockerSection({ data, capabilities, onPruneImages, onPruneVolumes }: DockerSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      {data.warning && (
        <InfoBanner text={data.warning} variant={data.unavailable ? "warning" : "info"} />
      )}

      {/* ── Engine Status ── */}
      <SectionDivider title="Engine" />
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Containers" value={data.total} />
        <StatCard label="Running" value={data.running} valueClass="text-status-green" />
        <StatCard label="Images" value={data.images} />
      </div>

      <div className={cn(SETTINGS_PANEL_INSET, "mt-1.5 divide-y divide-glass-border/50 px-4")}>
        <InfoRow label="Docker version" value={data.engineVersion} mono />
        <InfoRow label="Compose version" value={data.composeVersion} mono />
        <InfoRow label="Storage driver" value={data.storageDriver} />
        <InfoRow label="Cgroup driver" value={data.cgroupDriver} />
      </div>

      {/* ── Maintenance ── */}
      <SectionDivider title="Maintenance" />
      {data.pruneImages.error && <InfoBanner text={data.pruneImages.error} variant="warning" />}
      {data.pruneVolumes.error && <InfoBanner text={data.pruneVolumes.error} variant="warning" />}

      <div className="flex flex-col gap-1.5">
        <MaintenanceRow
          label="Prune unused images"
          description="Removes dangling and unreferenced images"
          pending={data.pruneImages.isPending}
          disabled={capabilities.pruneImages.disabled}
          disabledReason={capabilities.pruneImages.disabledReason}
          onClick={() => void onPruneImages()}
        />
        <MaintenanceRow
          label="Prune unused volumes"
          description="Removes volumes not attached to any container"
          pending={data.pruneVolumes.isPending}
          disabled={capabilities.pruneVolumes.disabled}
          disabledReason={capabilities.pruneVolumes.disabledReason}
          onClick={() => void onPruneVolumes()}
        />
      </div>
    </div>
  );
}
