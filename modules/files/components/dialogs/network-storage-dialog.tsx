"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Network, Plus, RefreshCw } from "@/components/icons/platform-icons";
import { FILES_PANEL_INSET } from "@/modules/files/components/file-manager-surface";
import {
  useCreateNetworkShare,
  useDiscoverNetworkServers,
  useDiscoverNetworkShares,
  useMountNetworkShare,
  useNetworkShares,
  useRemoveNetworkShare,
  useUnmountNetworkShare,
} from "@/modules/files/hooks/useNetworkShares";
import {
  AddNetworkShareDialog,
  type AddNetworkShareDraft,
} from "@/modules/files/components/dialogs/network-storage/add-network-share-dialog";
import { ConfiguredSharesPanel } from "@/modules/files/components/dialogs/network-storage/configured-shares-panel";
import { DiscoveredServersPanel } from "@/modules/files/components/dialogs/network-storage/discovered-servers-panel";
import { useEffect, useMemo, useRef, useState } from "react";

type NetworkStorageDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToNetwork: () => void;
};

const EMPTY_DRAFT: AddNetworkShareDraft = {
  host: "",
  share: "",
  username: "",
  password: "",
};

export function NetworkStorageDialog({
  isOpen,
  onClose,
  onNavigateToNetwork,
}: NetworkStorageDialogProps) {
  const autoDiscoverRanRef = useRef(false);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [draft, setDraft] = useState<AddNetworkShareDraft>(EMPTY_DRAFT);
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

  useEffect(() => {
    if (isOpen) return;
    autoDiscoverRanRef.current = false;
    setIsAddFormOpen(false);
    setDraft(EMPTY_DRAFT);
    setLocalError(null);
    setDiscoveredServers([]);
    setDiscoveredShares([]);
  }, [isOpen]);

  const discoverServersMutate = discoverServers.mutateAsync;
  useEffect(() => {
    if (!isOpen || autoDiscoverRanRef.current) return;
    autoDiscoverRanRef.current = true;
    setLocalError(null);
    void discoverServersMutate()
      .then((result) => {
        setDiscoveredServers(result.servers);
      })
      .catch(() => {
        // Errors surface through the mutation state.
      });
  }, [discoverServersMutate, isOpen]);

  async function handleDiscoverServers() {
    setLocalError(null);
    const result = await discoverServers.mutateAsync();
    setDiscoveredServers(result.servers);
  }

  async function handleDiscoverShares() {
    setLocalError(null);
    if (!draft.host.trim() || !draft.username.trim() || !draft.password) {
      setLocalError("Host, username, and password are required to discover shares.");
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
    if (!draft.host.trim() || !draft.share.trim() || !draft.username.trim() || !draft.password) {
      setLocalError("Host, share, username, and password are required.");
      return;
    }

    await createShare.mutateAsync({
      host: draft.host.trim(),
      share: draft.share.trim(),
      username: draft.username.trim(),
      password: draft.password,
    });

    setIsAddFormOpen(false);
    onNavigateToNetwork();
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          className={`max-w-[min(96vw,72rem)] gap-0 overflow-hidden border-glass-border/80 bg-background/95 p-0 ${FILES_PANEL_INSET}`}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Network Storage</DialogTitle>
            <DialogDescription>Discover, mount, and manage SMB shares.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 border-b border-glass-border/80 bg-background/48 px-4 py-3">
            <Network className="size-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-foreground">Network Storage</h2>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                setIsAddFormOpen(true);
              }}
              disabled={isBusy}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/20 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                void handleDiscoverServers();
              }}
              disabled={isBusy}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh discovered servers"
              title="Refresh discovered servers"
            >
              {discoverServers.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </button>
          </div>

          <div className="grid min-h-[50vh] grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
            <DiscoveredServersPanel
              discoveredServers={discoveredServers}
              host={draft.host}
              isPending={discoverServers.isPending}
              onSelectServer={(host) => {
                setDraft((current) => ({ ...current, host }));
                setIsAddFormOpen(true);
              }}
            />
            <ConfiguredSharesPanel
              isBusy={isBusy}
              isLoading={sharesQuery.isLoading}
              items={sharesQuery.data ?? []}
              onMount={(id) => {
                void mountShare.mutateAsync(id);
              }}
              onRemove={(id) => {
                void removeShare.mutateAsync(id);
              }}
              onUnmount={(id) => {
                void unmountShare.mutateAsync(id);
              }}
            />
          </div>

          {apiError ? (
            <div className="border-t border-glass-border/80 bg-background/42 px-4 py-2 text-xs text-status-red">
              {apiError}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AddNetworkShareDialog
        createPending={createShare.isPending}
        discoverSharesPending={discoverShares.isPending}
        discoveredShares={discoveredShares}
        draft={draft}
        isBusy={isBusy}
        isOpen={isOpen && isAddFormOpen}
        onClose={() => setIsAddFormOpen(false)}
        onDiscoverServers={() => {
          void handleDiscoverServers();
        }}
        onDiscoverShares={() => {
          void handleDiscoverShares();
        }}
        onDraftChange={setDraft}
        onSelectShare={(share) => {
          setDraft((current) => ({ ...current, share }));
        }}
        onSubmit={() => {
          void handleAddShare();
        }}
      />
    </>
  );
}
