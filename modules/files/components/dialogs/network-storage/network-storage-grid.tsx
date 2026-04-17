"use client";

import { Globe, Loader2, Plug, Trash2 } from "@/components/icons/platform-icons";

type ConfiguredShare = {
  id: string;
  host: string;
  share: string;
  mountPath: string;
  isMounted: boolean;
};

type NetworkStorageGridProps = {
  configuredShares: ConfiguredShare[];
  discoveredServers: string[];
  isBusy: boolean;
  isDiscovering: boolean;
  selectedHost: string;
  onMount: (id: string) => void;
  onRemove: (id: string) => void;
  onSelectServer: (host: string) => void;
  onUnmount: (id: string) => void;
};

export function NetworkStorageGrid({
  configuredShares,
  discoveredServers,
  isBusy,
  isDiscovering,
  selectedHost,
  onMount,
  onRemove,
  onSelectServer,
  onUnmount,
}: NetworkStorageGridProps) {
  const hasContent = discoveredServers.length > 0 || configuredShares.length > 0;

  if (isDiscovering && !hasContent) {
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Scanning network...
      </div>
    );
  }

  if (!hasContent) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
        <Globe className="size-8 opacity-25" />
        <span>No servers or shares found.</span>
        <span className="text-xs opacity-60">Try rescanning the network.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {discoveredServers.map((server) => (
        <div
          key={`discovered-${server}`}
          className={`relative flex aspect-square flex-col justify-between rounded-2xl border p-3 transition-colors ${
            selectedHost === server
              ? "border-sky-500/40 bg-sky-500/8"
              : "border-glass-border bg-card/92"
          }`}
        >
          <div className="flex size-9 items-center justify-center rounded-xl border border-glass-border bg-background/55">
            <Globe className="size-4 text-sky-400" />
          </div>

          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              Server
            </div>
            <div className="mt-0.5 truncate text-xs font-medium text-foreground">
              {server}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectServer(server)}
            disabled={isBusy}
            className="w-full rounded-lg bg-sky-500/15 py-1.5 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Use
          </button>
        </div>
      ))}

      {configuredShares.map((share) => (
        <div
          key={`configured-${share.id}`}
          className={`relative flex aspect-square flex-col justify-between rounded-2xl border p-3 transition-colors ${
            share.isMounted
              ? "border-emerald-500/20 bg-card/92"
              : "border-glass-border bg-card/92"
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex size-9 items-center justify-center rounded-xl border border-glass-border bg-background/55">
              <Plug className={`size-4 ${share.isMounted ? "text-emerald-400" : "text-amber-400"}`} />
            </div>
            <button
              type="button"
              onClick={() => onRemove(share.id)}
              disabled={isBusy}
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-status-red/10 hover:text-status-red disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Remove share"
            >
              <Trash2 className="size-3" />
            </button>
          </div>

          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              Share
            </div>
            <div className="mt-0.5 truncate text-xs font-medium text-foreground">
              {share.host}/{share.share}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-muted-foreground/70">
              /{share.mountPath}
            </div>
          </div>

          {share.isMounted ? (
            <button
              type="button"
              onClick={() => onUnmount(share.id)}
              disabled={isBusy}
              className="w-full rounded-lg bg-emerald-500/15 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Unmount
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onMount(share.id)}
              disabled={isBusy}
              className="w-full rounded-lg bg-amber-500/15 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Mount
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
