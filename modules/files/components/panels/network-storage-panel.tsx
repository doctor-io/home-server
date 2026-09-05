"use client";

import {
  Globe,
  HardDrive,
  Loader2,
  Plug,
  Plus,
  RefreshCw,
  Trash2,
} from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";
import {
  AddNetworkShareDialog,
  type AddNetworkShareDraft,
} from "@/modules/files/components/dialogs/network-storage/add-network-share-dialog";
import {
  useCreateNetworkShare,
  useDiscoverNetworkServers,
  useDiscoverNetworkShares,
  useMountNetworkShare,
  useNetworkShares,
  useRemoveNetworkShare,
  useUnmountNetworkShare,
} from "@/modules/files/hooks/useNetworkShares";
import { useState } from "react";

type Tab = "configured" | "discovered";

const EMPTY_DRAFT: AddNetworkShareDraft = {
  host: "",
  share: "",
  username: "",
  password: "",
};

export function NetworkStoragePanel({
  onNavigateToNetwork,
}: {
  onNavigateToNetwork: () => void;
}) {
  const [tab, setTab] = useState<Tab>("configured");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [draft, setDraft] = useState<AddNetworkShareDraft>(EMPTY_DRAFT);
  const [discoveredServers, setDiscoveredServers] = useState<string[]>([]);
  const [discoveredShares, setDiscoveredShares] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

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

  const error =
    localError ??
    (sharesQuery.error instanceof Error ? sharesQuery.error.message : null) ??
    (discoverServers.error instanceof Error
      ? discoverServers.error.message
      : null) ??
    (createShare.error instanceof Error ? createShare.error.message : null) ??
    (removeShare.error instanceof Error ? removeShare.error.message : null);

  async function handleRescan() {
    setLocalError(null);
    const result = await discoverServers.mutateAsync();
    setDiscoveredServers(result.servers);
    setTab("discovered");
  }

  async function handleDiscoverShares() {
    setLocalError(null);
    if (!draft.host.trim() || !draft.username.trim() || !draft.password) {
      setLocalError("Host, username, and password are required.");
      return;
    }
    const result = await discoverShares.mutateAsync({
      host: draft.host.trim(),
      username: draft.username.trim(),
      password: draft.password,
    });
    setDiscoveredShares(result.shares);
  }

  async function handleAddShare() {
    setLocalError(null);
    if (
      !draft.host.trim() ||
      !draft.share.trim() ||
      !draft.username.trim() ||
      !draft.password
    ) {
      setLocalError("All fields are required.");
      return;
    }
    await createShare.mutateAsync({
      host: draft.host.trim(),
      share: draft.share.trim(),
      username: draft.username.trim(),
      password: draft.password,
    });
    setIsAddOpen(false);
    setDraft(EMPTY_DRAFT);
    onNavigateToNetwork();
  }

  const shares = sharesQuery.data ?? [];

  return (
    <div className="flex h-full flex-col bg-background/60">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-glass-border/60 px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg border border-glass-border/60 bg-background/40 p-0.5">
          {(["configured", "discovered"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
              {t === "configured" && shares.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-3xs text-primary">
                  {shares.length}
                </span>
              )}
              {t === "discovered" && discoveredServers.length > 0 && (
                <span className="ml-1.5 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-3xs text-sky-400">
                  {discoveredServers.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleRescan()}
            disabled={isBusy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {discoverServers.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Rescan
          </button>
          <button
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setIsAddOpen(true);
            }}
            disabled={isBusy}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="size-3.5" />
            Add share
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "configured" ? (
          shares.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
              <HardDrive className="size-10 opacity-20" />
              <p className="text-sm">No configured shares</p>
              <p className="text-xs opacity-60">
                {`Click 'Add share' to connect an SMB/NAS share.`}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-glass-border/40">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className={cn(
                    "flex items-center gap-3 px-5 py-4 transition-colors hover:bg-background/30",
                    share.isMounted && "bg-emerald-500/5",
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                    <Plug
                      className={`size-4 ${share.isMounted ? "text-emerald-400" : "text-amber-400"}`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {share.host}/{share.share}
                      </span>
                      {share.isMounted && (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-3xs font-medium text-emerald-400">
                          Mounted
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {share.mountPath}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {share.isMounted ? (
                      <button
                        onClick={() => mountShare.mutate(share.id)}
                        disabled={isBusy}
                        className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/25 disabled:opacity-40"
                      >
                        Unmount
                      </button>
                    ) : (
                      <button
                        onClick={() => unmountShare.mutate(share.id)}
                        disabled={isBusy}
                        className="rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/25 disabled:opacity-40"
                      >
                        Mount
                      </button>
                    )}
                    <button
                      onClick={() => removeShare.mutate(share.id)}
                      disabled={isBusy}
                      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:bg-status-red/10 hover:text-status-red disabled:opacity-40"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : discoveredServers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <Globe className="size-10 opacity-20" />
            <p className="text-sm">No servers discovered</p>
            <p className="text-xs opacity-60">
              {`Click "Rescan" to scan your network.`}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-glass-border/40">
            {discoveredServers.map((server) => (
              <li
                key={server}
                className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-background/30"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-background/55">
                  <Globe className="size-4 text-sky-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">
                    {server}
                  </span>
                  <p className="text-xs text-muted-foreground">SMB server</p>
                </div>
                <button
                  onClick={() => {
                    setDraft((d) => ({ ...d, host: server }));
                    setIsAddOpen(true);
                  }}
                  className="shrink-0 rounded-lg bg-sky-500/15 px-3 py-1.5 text-xs font-medium text-sky-400 transition-colors hover:bg-sky-500/25"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="shrink-0 border-t border-glass-border bg-status-red/8 px-5 py-3 text-xs text-status-red">
          {error}
        </div>
      )}

      <AddNetworkShareDialog
        createPending={createShare.isPending}
        discoverSharesPending={discoverShares.isPending}
        discoveredShares={discoveredShares}
        draft={draft}
        isBusy={isBusy}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onDiscoverServers={() => void handleRescan()}
        onDiscoverShares={() => void handleDiscoverShares()}
        onDraftChange={setDraft}
        onSelectShare={(share) => setDraft((d) => ({ ...d, share }))}
        onSubmit={() => void handleAddShare()}
      />
    </div>
  );
}
