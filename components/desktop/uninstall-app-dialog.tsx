"use client";

import { useEffect, useId, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

type UninstallAppDialogProps = {
  open: boolean;
  appName: string | null;
  isSubmitting: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { deleteData: boolean }) => Promise<void>;
};

export function UninstallAppDialog({
  open,
  appName,
  isSubmitting,
  error,
  onOpenChange,
  onConfirm,
}: UninstallAppDialogProps) {
  const [deleteData, setDeleteData] = useState(false);
  const switchId = useId();

  useEffect(() => {
    if (!open) {
      setDeleteData(false);
    }
  }, [open]);

  async function handleConfirm() {
    await onConfirm({ deleteData });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-popover/95 border-glass-border">
        <DialogHeader>
          <DialogTitle>{`Uninstall ${appName ?? "app"}?`}</DialogTitle>
          <DialogDescription>
            This will stop and remove the app containers. Enable data deletion only if you want to remove app files too.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-glass-border bg-glass px-3 py-2">
          <label htmlFor={switchId} className="flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium text-foreground">Delete app data</p>
              <p className="text-xs text-muted-foreground">Removes data stored under DATA/Apps for this app.</p>
            </div>
            <Switch
              id={switchId}
              checked={deleteData}
              onCheckedChange={setDeleteData}
              disabled={isSubmitting}
              aria-label="Delete app data"
            />
          </label>
        </div>

        {error ? <p className="text-xs text-status-red">{error}</p> : null}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-glass-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || !appName}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-status-red text-white hover:brightness-110 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Uninstalling..." : "Uninstall"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
