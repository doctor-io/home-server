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

  const hasDiscovered = discoveredServers.length > 0;
  const hasConfigured = configuredShares.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {hasDiscovered && (
        <div>
          <p className="mb-2 text-3xs uppercase tracking-[0.18em] text-muted-foreground/50">
            Discovered on network
          </p>
          <div className="flex flex-col gap-1.5">
            {discoveredServers.map((server) => (
              <div
                key={`discovered-${server}`}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  selectedHost === server
                    ? "border-sky-500/40 bg-sky-500/8"
                    : "border-glass-border bg-card/60"
                }`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                  <Globe className="size-4 text-sky-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{server}</div>
                  <div className="text-3xs text-muted-foreground/60">SMB server</div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectServer(server)}
                  disabled={isBusy}
                  className="shrink-0 rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasConfigured && (
        <div>
          <p className="mb-2 text-3xs uppercase tracking-[0.18em] text-muted-foreground/50">
            Configured shares
          </p>
          <div className="flex flex-col gap-1.5">
            {configuredShares.map((share) => (
              <div
                key={`configured-${share.id}`}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                  share.isMounted
                    ? "border-emerald-500/20 bg-card/60"
                    : "border-glass-border bg-card/60"
                }`}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                  <Plug className={`size-4 ${share.isMounted ? "text-emerald-400" : "text-amber-400"}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {share.host}/{share.share}
                  </div>
                  <div className="truncate text-3xs text-muted-foreground/60">
                    Mounted at /{share.mountPath}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {share.isMounted ? (
                    <button
                      type="button"
                      onClick={() => onUnmount(share.id)}
                      disabled={isBusy}
                      className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Unmount
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMount(share.id)}
                      disabled={isBusy}
                      className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Mount
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(share.id)}
                    disabled={isBusy}
                    className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-status-red/10 hover:text-status-red disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Remove share"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
