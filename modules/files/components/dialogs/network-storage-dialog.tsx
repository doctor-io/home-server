"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, RefreshCw, XIcon } from "@/components/icons/platform-icons";
import { useCurrentUser } from "@/hooks/useCurrentUser";
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
import { NetworkStorageGrid } from "@/modules/files/components/dialogs/network-storage/network-storage-grid";
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
  const currentUserQuery = useCurrentUser();
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
  const isDemoMode = currentUserQuery.data?.isDemoMode ?? false;

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

  if (isDemoMode) return null;

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
          className="max-w-[min(96vw,60rem)] gap-0 overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border-glass-border bg-popover/96 p-0 shadow-2xl shadow-black/45 backdrop-blur-2xl"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Network Storage</DialogTitle>
            <DialogDescription>Discover, mount, and manage SMB shares.</DialogDescription>
          </DialogHeader>

          {/* Header */}
          <div className="border-b border-glass-border/60 bg-popover/70 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Network Storage</h2>
                <p className="text-sm text-muted-foreground">SMB/NAS shares on your network</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDiscoverServers()}
                  disabled={isBusy}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-glass-border bg-background/80 px-3 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {discoverServers.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}
                  Rescan
                </button>
                <DialogClose className="inline-flex size-9 items-center justify-center rounded-lg border border-glass-border bg-background/80 text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground">
                  <XIcon className="size-4" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
            </div>
          </div>

          {/* Grid + floating add button */}
          <div className="relative min-h-[50vh] overflow-y-auto p-5">
            <NetworkStorageGrid
              configuredShares={sharesQuery.data ?? []}
              discoveredServers={discoveredServers}
              isBusy={isBusy}
              isDiscovering={discoverServers.isPending}
              selectedHost={draft.host}
              onMount={(id) => void mountShare.mutateAsync(id)}
              onRemove={(id) => void removeShare.mutateAsync(id)}
              onSelectServer={(host) => {
                setDraft((current) => ({ ...current, host }));
                setIsAddFormOpen(true);
              }}
              onUnmount={(id) => void unmountShare.mutateAsync(id)}
            />
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                setIsAddFormOpen(true);
              }}
              disabled={isBusy}
              className="absolute bottom-5 right-5 flex size-11 items-center justify-center rounded-full bg-primary/20 text-primary shadow-lg shadow-primary/10 transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Add network share"
              title="Add network share"
            >
              <Plus className="size-5" />
            </button>
          </div>

          {apiError ? (
            <div className="border-t border-glass-border bg-status-red/8 px-5 py-3 text-xs text-status-red">
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
        onDiscoverServers={() => void handleDiscoverServers()}
        onDiscoverShares={() => void handleDiscoverShares()}
        onDraftChange={setDraft}
        onSelectShare={(share) => setDraft((current) => ({ ...current, share }))}
        onSubmit={() => void handleAddShare()}
      />
    </>
  );
}
