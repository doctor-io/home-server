"use client";

import { Loader2, Network, Plug, PlugZap, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useCreateNetworkShare,
  useDiscoverNetworkServers,
  useDiscoverNetworkShares,
  useMountNetworkShare,
  useNetworkShares,
  useRemoveNetworkShare,
  useUnmountNetworkShare,
} from "@/hooks/useNetworkShares";

type NetworkStorageDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToNetwork: () => void;
};

export function NetworkStorageDialog({
  isOpen,
  onClose,
  onNavigateToNetwork,
}: NetworkStorageDialogProps) {
  const [host, setHost] = useState("");
  const [share, setShare] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [discoveredServers, setDiscoveredServers] = useState<string[]>([]);
  const [discoveredShares, setDiscoveredShares] = useState<string[]>([]);

  const sharesQuery = useNetworkShares();
  const discoverServers = useDiscoverNetworkServers();
  const discoverShares = useDiscoverNetworkShares();
  const createShare = useCreateNetworkShare();
  const removeShare = useRemoveNetworkShare();
  const mountShare = useMountNetworkShare();
  const unmountShare = useUnmountNetworkShare();

  const isBusy =
    discoverServers.isPending ||
    discoverShares.isPending ||
    createShare.isPending ||
    removeShare.isPending ||
    mountShare.isPending ||
    unmountShare.isPending;

  const apiError = useMemo(() => {
    return (
      localError ||
      (sharesQuery.error instanceof Error ? sharesQuery.error.message : null) ||
      (discoverServers.error instanceof Error ? discoverServers.error.message : null) ||
      (discoverShares.error instanceof Error ? discoverShares.error.message : null) ||
      (createShare.error instanceof Error ? createShare.error.message : null) ||
      (removeShare.error instanceof Error ? removeShare.error.message : null) ||
      (mountShare.error instanceof Error ? mountShare.error.message : null) ||
      (unmountShare.error instanceof Error ? unmountShare.error.message : null)
    );
  }, [
    createShare.error,
    discoverServers.error,
    discoverShares.error,
    localError,
    mountShare.error,
    removeShare.error,
    sharesQuery.error,
    unmountShare.error,
  ]);

  if (!isOpen) {
    return null;
  }

  async function handleDiscoverServers() {
    setLocalError(null);
    const result = await discoverServers.mutateAsync();
    setDiscoveredServers(result.servers);
  }

  async function handleDiscoverShares() {
    setLocalError(null);

    if (!host.trim() || !username.trim() || !password) {
      setLocalError("Host, username, and password are required to discover shares.");
      return;
    }

    const result = await discoverShares.mutateAsync({
      host: host.trim(),
      username: username.trim(),
      password,
    });

    setDiscoveredShares(result.shares);
  }

  async function handleAddShare() {
    setLocalError(null);

    if (!host.trim() || !share.trim() || !username.trim() || !password) {
      setLocalError("Host, share, username, and password are required.");
      return;
    }

    await createShare.mutateAsync({
      host: host.trim(),
      share: share.trim(),
      username: username.trim(),
      password,
    });

    onNavigateToNetwork();
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-glass-border bg-popover shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-glass-border px-4 py-3">
          <Network className="size-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-foreground">Network Storage</h2>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
            aria-label="Close network storage dialog"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
          <section className="flex min-h-0 flex-col rounded-xl border border-glass-border bg-card/70 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Search className="size-3.5 text-muted-foreground" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Discover + Add SMB Share
              </h3>
            </div>

            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Host
                <div className="flex gap-2">
                  <input
                    value={host}
                    onChange={(event) => setHost(event.target.value)}
                    placeholder="nas.local"
                    className="h-8 flex-1 rounded-md border border-glass-border bg-secondary/35 px-2 text-xs text-foreground outline-none focus:border-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleDiscoverServers();
                    }}
                    disabled={isBusy}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-glass-border px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {discoverServers.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Servers
                  </button>
                </div>
              </label>

              {discoveredServers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {discoveredServers.map((server) => (
                    <button
                      key={server}
                      type="button"
                      onClick={() => setHost(server)}
                      className="rounded-md border border-glass-border bg-secondary/30 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
                    >
                      {server}
                    </button>
                  ))}
                </div>
              ) : null}

              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="user"
                  className="h-8 rounded-md border border-glass-border bg-secondary/35 px-2 text-xs text-foreground outline-none focus:border-primary/40"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-8 rounded-md border border-glass-border bg-secondary/35 px-2 text-xs text-foreground outline-none focus:border-primary/40"
                />
              </label>

              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Share
                <div className="flex gap-2">
                  <input
                    value={share}
                    onChange={(event) => setShare(event.target.value)}
                    placeholder="Media"
                    className="h-8 flex-1 rounded-md border border-glass-border bg-secondary/35 px-2 text-xs text-foreground outline-none focus:border-primary/40"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleDiscoverShares();
                    }}
                    disabled={isBusy}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-glass-border px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {discoverShares.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Search className="size-3" />
                    )}
                    Shares
                  </button>
                </div>
              </label>

              {discoveredShares.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {discoveredShares.map((shareName) => (
                    <button
                      key={shareName}
                      type="button"
                      onClick={() => setShare(shareName)}
                      className="rounded-md border border-glass-border bg-secondary/30 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
                    >
                      {shareName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-auto pt-3">
              <button
                type="button"
                onClick={() => {
                  void handleAddShare();
                }}
                disabled={isBusy}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-primary/20 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createShare.isPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <PlugZap className="size-3" />
                )}
                Add Share
              </button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col rounded-xl border border-glass-border bg-card/70 p-3">
            <div className="mb-3 flex items-center gap-2">
              <Plug className="size-3.5 text-emerald-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Configured Shares
              </h3>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {sharesQuery.isLoading ? (
                <div className="flex items-center justify-center rounded-md border border-dashed border-glass-border p-3 text-xs text-muted-foreground">
                  Loading shares...
                </div>
              ) : sharesQuery.data && sharesQuery.data.length > 0 ? (
                sharesQuery.data.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-glass-border bg-secondary/25 p-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {item.host}/{item.share}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                          item.isMounted
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {item.isMounted ? "mounted" : "unmounted"}
                      </span>
                      <div className="flex-1" />
                      <span className="text-[10px] text-muted-foreground">
                        /{item.mountPath}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.isMounted ? (
                        <button
                          type="button"
                          onClick={() => {
                            void unmountShare.mutateAsync(item.id);
                          }}
                          disabled={isBusy}
                          className="rounded-md border border-glass-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Unmount
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            void mountShare.mutateAsync(item.id);
                          }}
                          disabled={isBusy}
                          className="rounded-md border border-glass-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Mount
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          void removeShare.mutateAsync(item.id);
                        }}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-md border border-status-red/40 px-2 py-1 text-xs text-status-red transition-colors hover:bg-status-red/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="size-3" /> Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center rounded-md border border-dashed border-glass-border p-3 text-xs text-muted-foreground">
                  No network shares configured.
                </div>
              )}
            </div>
          </section>
        </div>

        {apiError ? (
          <div className="border-t border-glass-border px-4 py-2 text-xs text-status-red">
            {apiError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
