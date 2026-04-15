"use client";

import { Plug, Trash2 } from "@/components/icons/platform-icons";
import {
  FILES_BADGE_SURFACE,
  FILES_PANEL_INSET,
} from "@/modules/files/components/file-manager-surface";

type ConfiguredShare = {
  id: string;
  host: string;
  share: string;
  mountPath: string;
  isMounted: boolean;
};

type ConfiguredSharesPanelProps = {
  isBusy: boolean;
  isLoading: boolean;
  items: ConfiguredShare[];
  onMount: (id: string) => void;
  onRemove: (id: string) => void;
  onUnmount: (id: string) => void;
};

export function ConfiguredSharesPanel({
  isBusy,
  isLoading,
  items,
  onMount,
  onRemove,
  onUnmount,
}: ConfiguredSharesPanelProps) {
  return (
    <section className={`flex min-h-0 flex-col p-3 ${FILES_PANEL_INSET}`}>
      <div className="mb-3 flex items-center gap-2">
        <Plug className="size-3.5 text-emerald-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configured Shares
        </h3>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-md border border-dashed border-glass-border p-3 text-xs text-muted-foreground">
            Loading shares...
          </div>
        ) : items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-md border border-glass-border bg-background/55 p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">{item.host}/{item.share}</span>
                <span
                  className={`${FILES_BADGE_SURFACE} px-1.5 py-0.5 text-2xs uppercase tracking-wider ${
                    item.isMounted
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {item.isMounted ? "mounted" : "unmounted"}
                </span>
                <div className="flex-1" />
                <span className="text-2xs text-muted-foreground">/{item.mountPath}</span>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {item.isMounted ? (
                  <button
                    type="button"
                    onClick={() => onUnmount(item.id)}
                    disabled={isBusy}
                    className="rounded-md border border-glass-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Unmount
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMount(item.id)}
                    disabled={isBusy}
                    className="rounded-md border border-glass-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Mount
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
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
  );
}
