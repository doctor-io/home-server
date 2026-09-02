"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Cpu, Globe, HardDrive, MemoryStick, Server, Settings, Wifi } from "@/components/icons/platform-icons";
import { cn } from "@/lib/utils";
import type { SystemSummary, SystemSummaryApp } from "@/lib/shared/contracts/system-summary";

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

/** Colour only where it means something: amber at 75%, red at 90%. */
function toneFor(percent: number | null) {
  if (percent === null) return "";
  if (percent >= 90) return "text-status-red";
  if (percent >= 75) return "text-status-amber";
  return "";
}

function needsAttention(app: SystemSummaryApp) {
  return app.health === "unhealthy" || app.health === "stopped_by_policy" || app.status === "error";
}

function Stat({
  icon: Icon,
  percent,
  detail,
  label,
}: {
  icon: typeof Server;
  percent: number | null;
  detail: string;
  label: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5 px-1">
      <Icon className="size-4 opacity-60 grayscale" />
      <span className={cn("text-[15px] font-medium tabular-nums", toneFor(percent))}>
        {percent === null ? "—" : `${Math.round(percent)}%`}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {/* Kept even when empty so the three columns stay on one baseline. */}
      <span className="min-h-[0.9rem] truncate text-[10px] text-muted-foreground/60">{detail}</span>
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

  // Optional on the contract: a server older than this field answers without it.
  const network = summary.network;
  const installed = summary.apps.filter((app) => app.status === "installed").length;
  const attention = summary.apps.filter(needsAttention).length;

  return (
    // Fixed head, scrolling apps: the readings you opened the screen for stay
    // put, and only the list moves. Same shape as Monitor.
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Welcome home,</p>
          <h1 className="truncate text-lg font-medium">{summary.host.hostname}</h1>
        </div>
        {/* The only way into app-level settings from here — the tab bar is
            full, and five tabs is already the most a thumb wants. */}
        <Link
          href="/m/settings"
          aria-label="Settings"
          className="mt-1 grid size-9 shrink-0 place-items-center rounded-2xl active:bg-white/6"
        >
          <Settings className="size-5 opacity-40 grayscale" />
        </Link>
      </header>

      {/* One glance answers "is anything wrong?", and only then "with what?" */}
      <section className="rounded-3xl bg-white/5 px-5 py-4">
        <p className="text-[11px] text-muted-foreground">
          Homeio {summary.host.version} · up {formatUptime(summary.host.uptimeSeconds)}
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p
              className={cn(
                "text-[13px] font-medium",
                attention > 0 ? "text-status-amber" : "text-status-green",
              )}
            >
              {attention > 0
                ? `${attention} app${attention === 1 ? "" : "s"} need attention`
                : "Everything is healthy"}
            </p>
            <p className="mt-1 text-[2.75rem] leading-none font-medium tabular-nums">
              {installed}
              <span className="ml-1.5 text-2xl text-muted-foreground">
                app{installed === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          <Server className="size-14 opacity-40" />
        </div>
      </section>

      <section className="flex items-stretch rounded-3xl bg-white/5 px-2 py-3.5">
        <Stat
          icon={Cpu}
          percent={summary.cpu.usagePercent}
          label="CPU"
          detail={
            summary.cpu.temperatureCelsius === null
              ? ""
              : `${Math.round(summary.cpu.temperatureCelsius)}°C`
          }
        />
        <Stat
          icon={MemoryStick}
          percent={summary.memory.usagePercent}
          label="Memory"
          detail={formatBytes(summary.memory.usedBytes)}
        />
        <Stat
          icon={HardDrive}
          percent={summary.storage.usagePercent}
          label="Storage"
          detail={formatBytes(summary.storage.usedBytes)}
        />
      </section>

      {/* Where the server is, in the two facts you actually need when you are
          away from it: what it is on, and the address to reach it at. */}
      {network?.type && (
        <section className="flex items-center gap-3.5 rounded-3xl bg-white/5 px-4 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/5">
            {network.type === "wifi" ? (
              <Wifi className="size-5 grayscale" />
            ) : (
              <Globe className="size-5 grayscale" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{network.name ?? "Connected"}</p>
            <p className="text-[11px] text-muted-foreground">
              {network.type === "wifi" ? "Wi-Fi" : "Ethernet"}
              {network.type === "wifi" && network.signalPercent !== null
                ? ` · ${Math.round(network.signalPercent)}% signal`
                : network.iface
                  ? ` · ${network.iface}`
                  : ""}
            </p>
          </div>
          {network.ipv4 && (
            <span className="shrink-0 font-mono text-[12px] tabular-nums">{network.ipv4}</span>
          )}
        </section>
      )}

      <section className="flex min-h-0 flex-1 flex-col gap-2">
        <h2 className="shrink-0 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Apps
        </h2>

        {summary.apps.length === 0 ? (
          <p className="rounded-2xl bg-white/4 px-3.5 py-3 text-[12px] text-muted-foreground">
            Nothing installed yet.
          </p>
        ) : (
          // Every app, not the first six: the list scrolls on its own now, so a
          // cap would just be an arbitrary place for it to stop.
          <ul className="min-h-0 flex-1 overflow-y-auto rounded-3xl bg-white/4 pb-0">
            {summary.apps.map((app) => (
              <li key={app.appId} className="border-b border-white/5 last:border-b-0">
                <Link
                  href="/m/apps"
                  className="flex min-h-14 items-center gap-3 px-3.5 py-3 active:bg-white/6"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      needsAttention(app)
                        ? "bg-status-red"
                        : app.status === "installed"
                          ? "bg-status-green"
                          : "bg-white/25",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{app.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {app.webUiPort ? `:${app.webUiPort}` : app.status}
                  </span>
                  <ChevronRight className="size-4 shrink-0 opacity-35" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
