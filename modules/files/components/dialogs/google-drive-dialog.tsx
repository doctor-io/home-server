"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Cloud, Loader2, Trash2, X } from "@/components/icons/platform-icons";
import { useEffect, useRef } from "react";
import { useGoogleDriveConnections, useRemoveGoogleDriveConnection } from "@/modules/files/hooks/useGoogleDrive";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/shared/query-keys";

type GoogleDriveDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function GoogleDriveDialog({ isOpen, onClose }: GoogleDriveDialogProps) {
  const connectionsQuery = useGoogleDriveConnections();
  const removeConnection = useRemoveGoogleDriveConnection();
  const queryClient = useQueryClient();
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "gd-oauth-complete") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.googleDriveConnections });
        popupRef.current = null;
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [queryClient]);

  function handleConnect() {
    const popup = window.open(
      "/api/v1/files/google-drive/auth",
      "google-drive-auth",
      "width=600,height=700,left=200,top=100",
    );
    if (popup) popupRef.current = popup;
  }

  const connections = connectionsQuery.data ?? [];
  const isConfigured = !connectionsQuery.error?.message.includes("not configured");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(96vw,36rem)] gap-0 overflow-hidden rounded-[calc(var(--radius)+0.75rem)] border-glass-border bg-popover/96 p-0 shadow-2xl shadow-black/45 backdrop-blur-2xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Google Drive</DialogTitle>
          <DialogDescription>Connect and manage Google Drive accounts.</DialogDescription>
        </DialogHeader>

        {/* Window chrome title bar */}
        <div className="flex h-11 shrink-0 select-none items-center gap-0 border-b border-glass-border/50 bg-popover/70 backdrop-blur-2xl">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5 px-4">
            <button
              onClick={onClose}
              className="group flex size-3 cursor-pointer items-center justify-center rounded-full bg-[#ff5f57] transition-all hover:brightness-110"
              aria-label="Close"
            >
              <X className="size-[7px] text-[#6a0002] opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            <span className="size-3 rounded-full bg-white/10" />
            <span className="size-3 rounded-full bg-white/10" />
          </div>

          {/* Centered title */}
          <div className="flex flex-1 items-center justify-center gap-1.5">
            <Cloud className="size-3.5 text-sky-400" />
            <span className="text-xs font-medium text-foreground/80">Google Drive</span>
          </div>

          {/* Right gutter — balances traffic lights */}
          <div className="w-[76px]" />
        </div>

        {/* Body */}
        <div className="min-h-[16rem] p-5">
          {connectionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !isConfigured ? (
            <div className="rounded-lg border border-glass-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Google Drive not configured</p>
              <p className="mt-1">
                Add <code className="rounded bg-background/60 px-1 py-0.5 text-xs font-mono">GOOGLE_CLIENT_ID</code>{" "}
                and{" "}
                <code className="rounded bg-background/60 px-1 py-0.5 text-xs font-mono">GOOGLE_CLIENT_SECRET</code>{" "}
                to your environment variables.
              </p>
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <Cloud className="size-12 text-muted-foreground/30" />
              <div>
                <p className="font-medium text-foreground">No accounts connected</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect a Google account to access your Drive files.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {connections.map((conn) => (
                <li
                  key={conn.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-glass-border/60 bg-background/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {conn.displayName ?? conn.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{conn.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeConnection.mutate(conn.id)}
                    disabled={removeConnection.isPending}
                    title="Disconnect"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-background/50 hover:text-status-red disabled:opacity-40"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {isConfigured && (
          <div className="border-t border-glass-border/60 bg-popover/70 px-5 py-4">
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-sky-500/15 px-4 text-sm font-medium text-sky-400 transition-colors hover:bg-sky-500/25"
            >
              <Cloud className="size-4" />
              Connect Google Account
            </button>
          </div>
        )}

        {connectionsQuery.error && isConfigured ? (
          <div className="border-t border-glass-border bg-status-red/8 px-5 py-3 text-xs text-status-red">
            {connectionsQuery.error instanceof Error ? connectionsQuery.error.message : "Unknown error"}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
