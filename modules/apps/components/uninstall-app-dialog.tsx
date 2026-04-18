"use client";

import { useEffect, useId, useState } from "react";
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
    if (!open) setDeleteData(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed bottom-[5.75rem] left-1/2 z-[150] w-[min(92vw,32rem)] -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="overflow-hidden rounded-[var(--system-radius-control)] border border-glass-border/50 bg-popover/90 shadow-[0_8px_32px_rgba(0,0,0,0.28)] backdrop-blur-2xl">

        {/* Main row */}
        <div className="flex items-center gap-4 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm text-foreground/80">
            Uninstall{" "}
            <span className="font-medium text-foreground">{appName ?? "app"}</span>?
          </p>

          <label
            htmlFor={switchId}
            className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground/70 hover:text-foreground"
          >
            <Switch
              id={switchId}
              checked={deleteData}
              onCheckedChange={setDeleteData}
              disabled={isSubmitting}
              aria-label="Delete app data"
              className="data-[state=unchecked]:border-white/20"
            />
            Delete data
          </label>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-8 rounded-[var(--system-radius-control)] border border-glass-border/60 bg-white/5 px-3 text-xs font-medium text-foreground/70 transition-colors hover:bg-white/8 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void onConfirm({ deleteData })}
              disabled={isSubmitting || !appName}
              className="h-8 rounded-[var(--system-radius-control)] border border-status-red/20 bg-status-red/12 px-3 text-xs font-medium text-status-red transition-colors hover:bg-status-red/20 disabled:opacity-50"
            >
              {isSubmitting ? "Uninstalling…" : "Uninstall"}
            </button>
          </div>
        </div>

        {/* Error — system-error-capsule style */}
        {error ? (
          <div className="border-t border-glass-border/40 px-4 py-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-status-red/18 bg-black/26 px-3 py-1.5 backdrop-blur-xl">
              <span className="size-1.5 shrink-0 rounded-full bg-status-red shadow-[0_0_10px_rgba(239,68,68,0.45)]" />
              <p className="text-xs tracking-[0.01em] text-status-red/92">{error}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
