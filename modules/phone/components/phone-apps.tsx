"use client";

import { useState } from "react";
import { ExternalLink, Play, RefreshCw, Square } from "@/components/icons/platform-icons";
import { useInstalledApps } from "@/modules/apps/hooks/useInstalledApps";
import { useSharedStoreActions } from "@/modules/apps/hooks/StoreActionsContext";
import type { InstalledApp } from "@/lib/shared/contracts/apps";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<InstalledApp["status"], string> = {
  running: "Running",
  partial: "Partly running",
  paused: "Paused",
  stopped: "Stopped",
  unknown: "Unknown",
};

function statusTone(status: InstalledApp["status"]) {
  if (status === "running") return "bg-status-green";
  if (status === "partial" || status === "paused") return "bg-status-amber";
  if (status === "stopped") return "bg-white/25";
  return "bg-white/20";
}

/** The app's own web UI, on the host the phone already reached. */
function webUiUrl(app: InstalledApp): string | null {
  if (!app.webUiPort) return null;
  return `${window.location.protocol}//${window.location.hostname}:${app.webUiPort}`;
}

export function PhoneApps() {
  const { data: apps = [], isLoading } = useInstalledApps();
  const actions = useSharedStoreActions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(appId: string, action: "start" | "stop" | "restart") {
    setBusyId(appId);
    setError(null);

    try {
      if (action === "start") await actions.startApp(appId);
      else if (action === "stop") await actions.stopApp(appId);
      else await actions.restartApp(appId);
    } catch {
      setError(`Could not ${action} that app.`);
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading && apps.length === 0) {
    return <p className="mt-8 text-center text-sm text-muted-foreground">Loading apps…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-medium">Apps</h1>

      {error && (
        <p className="rounded-xl border border-status-red/30 bg-status-red/10 px-3 py-2 text-[12px] text-status-red" role="alert">
          {error}
        </p>
      )}

      {apps.length === 0 ? (
        <p className="rounded-xl border border-glass-border bg-black/20 px-3 py-4 text-[12px] text-muted-foreground">
          No apps installed. Install one from the App Store in desktop view.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {apps.map((app) => {
            const url = webUiUrl(app);
            const isBusy = busyId === app.id || Boolean(app.activeOperation);
            const isRunning = app.status === "running" || app.status === "partial";

            return (
              <li
                key={app.id}
                className="rounded-2xl border border-glass-border bg-black/20 px-3 py-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className={cn("size-2 shrink-0 rounded-full", statusTone(app.status))}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm">{app.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {app.activeOperation ? "Working…" : STATUS_LABELS[app.status]}
                  </span>
                </div>

                <div className="mt-2.5 flex gap-2">
                  {/* 44px minimum touch targets — anything smaller is a miss. */}
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={() => void run(app.id, "stop")}
                      disabled={isBusy}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-glass-border bg-black/25 text-[12px] text-muted-foreground disabled:opacity-50"
                    >
                      <Square className="size-3.5" /> Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void run(app.id, "start")}
                      disabled={isBusy}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-glass-border bg-black/25 text-[12px] text-muted-foreground disabled:opacity-50"
                    >
                      <Play className="size-3.5" /> Start
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void run(app.id, "restart")}
                    disabled={isBusy}
                    className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-glass-border bg-black/25 text-[12px] text-muted-foreground disabled:opacity-50"
                  >
                    <RefreshCw className={cn("size-3.5", isBusy && "animate-spin")} /> Restart
                  </button>

                  {url && (
                    <a
                      href={url}
                      className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/90 text-[12px] font-medium text-primary-foreground"
                    >
                      <ExternalLink className="size-3.5" /> Open
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
