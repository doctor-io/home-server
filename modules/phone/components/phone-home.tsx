"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SystemSummary } from "@/lib/shared/contracts/system-summary";

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours}h ${minutes}m`;
}

function Stat({
  label,
  value,
  detail,
  percent,
}: {
  label: string;
  value: string;
  detail?: string;
  percent: number | null;
}) {
  // Colour only where it means something: green is the default, amber and red
  // are the two states worth walking to the server for.
  const tone =
    percent === null
      ? "bg-white/20"
      : percent >= 90
        ? "bg-status-red"
        : percent >= 75
          ? "bg-status-amber"
          : "bg-status-green";

  return (
    <div className="rounded-2xl border border-glass-border bg-black/25 p-3">
      <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
      {detail && <p className="text-[11px] text-muted-foreground">{detail}</p>}
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
        <div
          className={cn("h-full rounded-full transition-all", tone)}
          style={{ width: `${Math.min(100, Math.max(2, percent ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

export function PhoneHome() {
  const [summary, setSummary] = useState<SystemSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/v1/system/summary");
        if (!response.ok) throw new Error("failed");
        const json = (await response.json()) as { data: SystemSummary };
        if (!cancelled) {
          setSummary(json.data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Could not reach the server.");
      }
    }

    void load();
    // The endpoint is cached for 5s server-side, so polling faster than that
    // would only cost round trips.
    const timer = setInterval(load, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (error && !summary) {
    return (
      <p className="mt-8 text-center text-sm text-status-red" role="alert">
        {error}
      </p>
    );
  }

  if (!summary) {
    return (
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">Reading system status…</p>
        <p className="mt-1 text-[11px] text-muted-foreground/60">
          The first read after a restart can take a few seconds.
        </p>
      </div>
    );
  }

  const running = summary.apps.filter((app) => app.status === "installed").length;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-medium">{summary.host.hostname}</h1>
        <p className="text-[11px] text-muted-foreground">
          Up {formatUptime(summary.host.uptimeSeconds)} · Homeio {summary.host.version} ·{" "}
          {summary.host.architecture}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat
          label="CPU"
          value={summary.cpu.usagePercent === null ? "—" : `${Math.round(summary.cpu.usagePercent)}%`}
          detail={
            summary.cpu.temperatureCelsius === null
              ? undefined
              : `${Math.round(summary.cpu.temperatureCelsius)}°C`
          }
          percent={summary.cpu.usagePercent}
        />
        <Stat
          label="Memory"
          value={
            summary.memory.usagePercent === null
              ? "—"
              : `${Math.round(summary.memory.usagePercent)}%`
          }
          detail={`${formatBytes(summary.memory.usedBytes)} of ${formatBytes(summary.memory.totalBytes)}`}
          percent={summary.memory.usagePercent}
        />
        <Stat
          label="Storage"
          value={
            summary.storage.usagePercent === null
              ? "—"
              : `${Math.round(summary.storage.usagePercent)}%`
          }
          detail={`${formatBytes(summary.storage.usedBytes)} of ${formatBytes(summary.storage.totalBytes)}`}
          percent={summary.storage.usagePercent}
        />
        <Stat label="Apps" value={String(summary.apps.length)} detail={`${running} installed`} percent={null} />
      </div>

      <section>
        <h2 className="mb-2 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Apps</h2>
        <ul className="flex flex-col gap-1.5">
          {summary.apps.length === 0 && (
            <li className="rounded-xl border border-glass-border bg-black/20 px-3 py-3 text-[12px] text-muted-foreground">
              Nothing installed yet.
            </li>
          )}
          {summary.apps.slice(0, 6).map((app) => (
            <li
              key={app.appId}
              className="flex items-center gap-3 rounded-xl border border-glass-border bg-black/20 px-3 py-2.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  app.health === "unhealthy" || app.health === "stopped_by_policy"
                    ? "bg-status-red"
                    : app.status === "installed"
                      ? "bg-status-green"
                      : "bg-white/25",
                )}
              />
              <span className="min-w-0 flex-1 truncate text-sm">{app.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {app.webUiPort ? `:${app.webUiPort}` : app.status}
              </span>
            </li>
          ))}
        </ul>
        {summary.apps.length > 6 && (
          <Link href="/m/apps" className="mt-2 block text-center text-[12px] text-primary">
            All {summary.apps.length} apps
          </Link>
        )}
      </section>

      <Link
        href="/"
        className="mb-2 block rounded-xl border border-glass-border bg-black/20 py-2.5 text-center text-[12px] text-muted-foreground"
      >
        Desktop view
      </Link>
    </div>
  );
}
