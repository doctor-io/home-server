import {
  InfoBanner,
  SectionDivider,
} from "@/modules/settings/components/panel/controls";
import { SETTINGS_PANEL_INSET } from "@/modules/settings/components/panel/surface";
import type { SettingsBackend } from "@/modules/settings/components/panel/types";

type DockerSectionProps = {
  data: SettingsBackend["docker"];
  capabilities: SettingsBackend["capabilities"]["docker"];
  onPruneImages: () => Promise<void>;
  onPruneVolumes: () => Promise<void>;
};

export function DockerSection({
  data,
  capabilities,
  onPruneImages,
  onPruneVolumes,
}: DockerSectionProps) {
  return (
    <div className="flex flex-col gap-1">
      {data.warning ? (
        <InfoBanner
          text={data.warning}
          variant={data.unavailable ? "warning" : "info"}
        />
      ) : null}
      <SectionDivider title="Engine Status" />
      <div className="grid grid-cols-3 gap-4 py-2">
        <div className={`${SETTINGS_PANEL_INSET} p-3 text-center`}>
          <span className="text-xl font-bold text-foreground">
            {data.total}
          </span>
          <span className="text-xs text-muted-foreground block mt-0.5">
            Containers
          </span>
        </div>
        <div className={`${SETTINGS_PANEL_INSET} p-3 text-center`}>
          <span className="text-xl font-bold text-status-green">
            {data.running}
          </span>
          <span className="text-xs text-muted-foreground block mt-0.5">
            Running
          </span>
        </div>
        <div className={`${SETTINGS_PANEL_INSET} p-3 text-center`}>
          <span className="text-xl font-bold text-foreground">
            {data.images}
          </span>
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

      <SectionDivider title="Maintenance" />
      {data.pruneImages.error ? (
        <InfoBanner text={data.pruneImages.error} variant="warning" />
      ) : null}
      {data.pruneVolumes.error ? (
        <InfoBanner text={data.pruneVolumes.error} variant="warning" />
      ) : null}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => {
            void onPruneImages();
          }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary"
          disabled={
            capabilities.pruneImages.disabled || data.pruneImages.isPending
          }
          title={capabilities.pruneImages.disabledReason}
        >
          {data.pruneImages.isPending
            ? "Pruning images..."
            : "Prune Unused Images"}
        </button>
        <button
          onClick={() => {
            void onPruneVolumes();
          }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary/50 text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:text-foreground enabled:hover:bg-secondary"
          disabled={
            capabilities.pruneVolumes.disabled || data.pruneVolumes.isPending
          }
          title={capabilities.pruneVolumes.disabledReason}
        >
          {data.pruneVolumes.isPending
            ? "Pruning volumes..."
            : "Prune Unused Volumes"}
        </button>
      </div>
    </div>
  );
}
