"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, PlugZap, RefreshCw, Search } from "@/components/icons/platform-icons";

export type AddNetworkShareDraft = {
  host: string;
  share: string;
  username: string;
  password: string;
};

type AddNetworkShareDialogProps = {
  createPending: boolean;
  discoverSharesPending: boolean;
  discoveredShares: string[];
  draft: AddNetworkShareDraft;
  isBusy: boolean;
  isOpen: boolean;
  onClose: () => void;
  onDiscoverServers: () => void;
  onDiscoverShares: () => void;
  onDraftChange: (updater: AddNetworkShareDraft | ((draft: AddNetworkShareDraft) => AddNetworkShareDraft)) => void;
  onSelectShare: (share: string) => void;
  onSubmit: () => void;
};

export function AddNetworkShareDialog({
  createPending,
  discoverSharesPending,
  discoveredShares,
  draft,
  isBusy,
  isOpen,
  onClose,
  onDiscoverServers,
  onDiscoverShares,
  onDraftChange,
  onSelectShare,
  onSubmit,
}: AddNetworkShareDialogProps) {
  function update<K extends keyof AddNetworkShareDraft>(key: K, value: AddNetworkShareDraft[K]) {
    onDraftChange((current) => ({ ...current, [key]: value }));
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-glass-border/80 bg-background/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <PlugZap className="size-4 text-primary" />
            Add Network Storage
          </DialogTitle>
          <DialogDescription>Configure an SMB share and mount it into the Files module.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Host
            <div className="flex gap-2">
              <input
                value={draft.host}
                onChange={(event) => update("host", event.target.value)}
                placeholder="nas.local"
                className="h-8 flex-1 rounded-md border border-glass-border bg-background/55 px-2 text-xs text-foreground outline-none focus:border-primary/40"
              />
              <button
                type="button"
                onClick={onDiscoverServers}
                disabled={isBusy}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-glass-border px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="size-3" />
                Servers
              </button>
            </div>
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Username
            <input
              value={draft.username}
              onChange={(event) => update("username", event.target.value)}
              placeholder="user"
              className="h-8 rounded-md border border-glass-border bg-background/55 px-2 text-xs text-foreground outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Password
            <input
              type="password"
              value={draft.password}
              onChange={(event) => update("password", event.target.value)}
              placeholder="••••••••"
              className="h-8 rounded-md border border-glass-border bg-background/55 px-2 text-xs text-foreground outline-none focus:border-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Share
            <div className="flex gap-2">
              <input
                value={draft.share}
                onChange={(event) => update("share", event.target.value)}
                placeholder="Media"
                className="h-8 flex-1 rounded-md border border-glass-border bg-background/55 px-2 text-xs text-foreground outline-none focus:border-primary/40"
              />
              <button
                type="button"
                onClick={onDiscoverShares}
                disabled={isBusy}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-glass-border px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {discoverSharesPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Search className="size-3" />
                )}
                Shares
              </button>
            </div>
          </label>

          {discoveredShares.length > 0 ? (
            <div className="max-h-20 overflow-y-auto rounded-md border border-glass-border bg-background/42 p-1.5">
              <div className="flex flex-wrap gap-1.5">
                {discoveredShares.map((shareName) => (
                  <button
                    key={shareName}
                    type="button"
                    onClick={() => onSelectShare(shareName)}
                    className="rounded-md border border-glass-border bg-background/55 px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/72 hover:text-foreground"
                  >
                    {shareName}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md border border-glass-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-primary/20 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createPending ? <Loader2 className="size-3 animate-spin" /> : <PlugZap className="size-3" />}
            Add Share
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
