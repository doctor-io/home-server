"use client";

import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Plus, RefreshCw, Search, XIcon } from "@/components/icons/platform-icons";

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

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
      <DialogContent showCloseButton={false} className="max-w-[34rem] gap-0 border-glass-border bg-popover/96 p-0 shadow-2xl shadow-black/45 backdrop-blur-2xl">
        <DialogHeader className="border-b border-glass-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-9 items-center justify-center rounded-lg border border-glass-border bg-background/80 text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div>
                <DialogTitle className="text-sm">Add Network Share</DialogTitle>
                <DialogDescription className="mt-0.5">
                  Connect to an SMB share
                </DialogDescription>
              </div>
            </div>
            <DialogClose className="inline-flex size-9 items-center justify-center rounded-lg border border-glass-border bg-background/80 text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5">
          {/* Server */}
          <div>
            <FieldLabel>Server</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={draft.host}
                onChange={(event) => update("host", event.target.value)}
                placeholder="Host or IP (e.g. nas.local, 192.168.1.100)"
                className="h-8 rounded-lg border-glass-border bg-background/55 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={onDiscoverServers}
                disabled={isBusy}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className="size-3" />
                Scan
              </button>
            </div>
          </div>

          {/* Credentials */}
          <div>
            <FieldLabel>Credentials</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={draft.username}
                onChange={(event) => update("username", event.target.value)}
                placeholder="Username"
                className="h-8 rounded-lg border-glass-border bg-background/55 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-0"
              />
              <Input
                type="password"
                value={draft.password}
                onChange={(event) => update("password", event.target.value)}
                placeholder="Password"
                className="h-8 rounded-lg border-glass-border bg-background/55 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Share */}
          <div>
            <FieldLabel>Share</FieldLabel>
            <div className="flex gap-2">
              <Input
                value={draft.share}
                onChange={(event) => update("share", event.target.value)}
                placeholder="Share name (e.g. Media, Documents)"
                className="h-8 rounded-lg border-glass-border bg-background/55 px-3 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary/40 focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={onDiscoverShares}
                disabled={isBusy}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {discoverSharesPending ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Search className="size-3" />
                )}
                Find
              </button>
            </div>

            {discoveredShares.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {discoveredShares.map((shareName) => (
                  <button
                    key={shareName}
                    type="button"
                    onClick={() => onSelectShare(shareName)}
                    className="rounded-lg border border-glass-border bg-background/55 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/75 hover:text-foreground"
                  >
                    {shareName}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-glass-border/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-glass-border bg-background/55 px-3 text-xs text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/20 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            Add Share
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
