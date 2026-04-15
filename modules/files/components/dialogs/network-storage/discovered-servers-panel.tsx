"use client";

import { Loader2, Search } from "@/components/icons/platform-icons";
import {
  FILES_BADGE_SURFACE,
  FILES_PANEL_INSET,
} from "@/modules/files/components/file-manager-surface";

type DiscoveredServersPanelProps = {
  discoveredServers: string[];
  host: string;
  isPending: boolean;
  onSelectServer: (host: string) => void;
};

export function DiscoveredServersPanel({
  discoveredServers,
  host,
  isPending,
  onSelectServer,
}: DiscoveredServersPanelProps) {
  return (
    <section className={`flex min-h-0 flex-col p-3 ${FILES_PANEL_INSET}`}>
      <div className="mb-3 flex items-center gap-2">
        <Search className="size-3.5 text-sky-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Discovered Servers
        </h3>
        <div className="flex-1" />
        <span className={`${FILES_BADGE_SURFACE} px-1.5 py-0.5 text-2xs text-muted-foreground`}>
          {discoveredServers.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {isPending ? (
          <div className="flex items-center justify-center rounded-md border border-dashed border-glass-border p-3 text-xs text-muted-foreground">
            <Loader2 className="mr-1.5 size-3 animate-spin" />
            Scanning network...
          </div>
        ) : discoveredServers.length > 0 ? (
          discoveredServers.map((server) => (
            <button
              key={server}
              type="button"
              onClick={() => onSelectServer(server)}
              className={`w-full rounded-md border px-2 py-2 text-left text-xs transition-colors ${
                host === server
                  ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
                  : "border-glass-border bg-background/55 text-muted-foreground hover:bg-background/72 hover:text-foreground"
              }`}
            >
              {server}
            </button>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-glass-border p-3 text-xs text-muted-foreground">
            No SMB servers discovered yet. Click refresh to scan.
          </div>
        )}
      </div>
    </section>
  );
}
