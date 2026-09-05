"use client";

import { useState } from "react";
import { ExternalLink, Package, Play, RefreshCw, Square } from "@/components/icons/platform-icons";
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

const FILTERS = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "stopped", label: "Stopped" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

function isRunning(app: InstalledApp) {
  return app.status === "running" || app.status === "partial";
}

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
  const [filter, setFilter] = useState<Filter>("all");

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

  const running = apps.filter(isRunning).length;
  const visible = apps.filter((app) => {
    if (filter === "running") return isRunning(app);
    if (filter === "stopped") return !isRunning(app);
    return true;
  });

  if (isLoading && apps.length === 0) {
    return <p className="mt-8 text-center text-sm text-muted-foreground">Loading apps…</p>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xs text-muted-foreground">
            {apps.length === 0
              ? "Nothing installed"
              : `${running} of ${apps.length} running`}
          </p>
          <h1 className="truncate text-lg font-medium">Apps</h1>
        </div>
        <Package className="mt-1 size-5 opacity-40 grayscale" />
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-status-red/10 px-3.5 py-2.5 text-xs text-status-red"
        >
          {error}
        </p>
      )}

      {apps.length === 0 ? (
        <div className="mt-10 flex flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-3xl bg-white/5">
            <Package className="size-6 opacity-50 grayscale" />
          </span>
          <p className="mt-3 text-sm text-muted-foreground">No apps installed</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Install one from the App Store in desktop view.
          </p>
        </div>
      ) : (
        <>
          {/* Same filter row as the other screens, and it earns its place here:
              on a server with a dozen apps, "what is down?" is the question. */}
          <div className="flex gap-5">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className="flex flex-col items-center gap-1.5 pt-1"
              >
                <span
                  className={cn(
                    "text-sm transition-colors",
                    filter === option.key ? "font-medium" : "text-muted-foreground",
                  )}
                >
                  {option.label}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1 rounded-full transition-colors",
                    filter === option.key ? "bg-primary" : "bg-transparent",
                  )}
                />
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl bg-white/4 px-3.5 py-3 text-xs text-muted-foreground">
              Nothing {filter === "running" ? "running" : "stopped"} right now.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {visible.map((app) => {
                const url = webUiUrl(app);
                const isBusy = busyId === app.id || Boolean(app.activeOperation);
                const live = isRunning(app);

                return (
                  <li key={app.id} className="rounded-3xl bg-white/5 px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        aria-hidden="true"
                        className={cn("size-2 shrink-0 rounded-full", statusTone(app.status))}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {app.name}
                      </span>
                      <span className="shrink-0 text-2xs text-muted-foreground">
                        {app.activeOperation ? "Working…" : STATUS_LABELS[app.status]}
                      </span>
                    </div>

                    {app.webUiPort && (
                      <p className="mt-0.5 pl-[1.125rem] text-2xs text-muted-foreground/70 tabular-nums">
                        port {app.webUiPort}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      {/* 44px minimum touch targets — anything smaller is a miss. */}
                      {live ? (
                        <button
                          type="button"
                          onClick={() => void run(app.id, "stop")}
                          disabled={isBusy}
                          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/6 text-xs text-muted-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
                        >
                          <Square className="size-3.5 grayscale" /> Stop
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void run(app.id, "start")}
                          disabled={isBusy}
                          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/6 text-xs text-muted-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
                        >
                          <Play className="size-3.5 grayscale" /> Start
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => void run(app.id, "restart")}
                        disabled={isBusy}
                        className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-white/6 text-xs text-muted-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
                      >
                        <RefreshCw className={cn("size-3.5 grayscale", isBusy && "animate-spin")} />{" "}
                        Restart
                      </button>

                      {/* Only while it can actually answer: Open on a stopped
                          app is a connection error with extra steps. */}
                      {url && live && (
                        <a
                          href={url}
                          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-primary text-xs font-medium text-primary-foreground transition-transform active:scale-[0.98]"
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
        </>
      )}
    </div>
  );
}
