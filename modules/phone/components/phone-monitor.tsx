"use client";

import { useEffect, useState } from "react";
import { useDockerStats } from "@/modules/system/hooks/useDockerStats";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
import { cn } from "@/lib/utils";

/** ~4 minutes at the default 2s publish interval, as on the desktop Monitor. */
const HISTORY_CAPACITY = 120;

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

/**
 * Same fixed-slot rendering as the desktop Monitor rather than a second
 * implementation: samples draw into a fixed number of slots so bars never
 * change width as history accumulates, and empty slots show the window filling.
 */
function HistoryBars({ values, tone }: { values: number[]; tone: string }) {
  const slots = Array.from({ length: HISTORY_CAPACITY }, (_, index) => {
    const offset = index - (HISTORY_CAPACITY - values.length);
    return offset >= 0 ? values[offset] : null;
  });

  return (
    <div className="flex h-14 items-end gap-px rounded-xl border border-glass-border bg-black/25 px-2 py-1.5">
      {values.length === 0 ? (
        <span className="m-auto text-[11px] text-muted-foreground">Collecting…</span>
      ) : (
        slots.map((value, index) => (
          <span
            key={index}
            className={cn(
              "min-w-0 flex-1 rounded-[1px] transition-[height] duration-300",
              value === null ? "bg-white/6" : tone,
            )}
            style={{ height: value === null ? "2px" : `${Math.max(2, Math.round(value))}%` }}
          />
        ))
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-glass-border/40 py-2 last:border-b-0">
      <span className="shrink-0 text-[12px] text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[12px]" title={value}>
        {value}
      </span>
    </div>
  );
}

export function PhoneMonitor() {
  const { data: metrics } = useSystemMetrics();
  const { stats, daemonAvailable } = useDockerStats();
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);

  useEffect(() => {
    if (!metrics) return;

    const cpu = metrics.cpu?.normalizedPercent ?? 0;
    const memory = metrics.memory?.usedPercent ?? 0;
    setCpuHistory((previous) => [...previous.slice(-(HISTORY_CAPACITY - 1)), cpu]);
    setMemHistory((previous) => [...previous.slice(-(HISTORY_CAPACITY - 1)), memory]);
  }, [metrics]);

  // Deliberately not gated on `metrics`: a cold metrics snapshot can take
  // several seconds (much worse on a macOS dev box than on the Linux hardware
  // this runs on), and the container list arrives long before it. Blocking the
  // whole screen on the slowest source makes the app look broken.
  const storage = metrics?.storage;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">Monitor</h1>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">CPU</h2>
          <span className="font-mono text-sm">
            {metrics ? `${Math.round(metrics.cpu?.normalizedPercent ?? 0)}%` : "—"}
          </span>
        </div>
        <HistoryBars values={cpuHistory} tone="bg-primary" />
        <div className="rounded-xl border border-glass-border bg-black/20 px-3">
          <Row label="Load 1m" value={metrics ? (metrics.cpu?.oneMinute ?? 0).toFixed(2) : "—"} />
          <Row label="Load 5m" value={metrics ? (metrics.cpu?.fiveMinute ?? 0).toFixed(2) : "—"} />
          <Row label="Load 15m" value={metrics ? (metrics.cpu?.fifteenMinute ?? 0).toFixed(2) : "—"} />
          {metrics?.temperature?.mainCelsius !== null &&
            metrics?.temperature?.mainCelsius !== undefined && (
              <Row label="Temperature" value={`${Math.round(metrics.temperature.mainCelsius)}°C`} />
            )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Memory</h2>
          <span className="font-mono text-sm">
            {metrics ? `${Math.round(metrics.memory?.usedPercent ?? 0)}%` : "—"}
          </span>
        </div>
        <HistoryBars values={memHistory} tone="bg-status-green" />
        <div className="rounded-xl border border-glass-border bg-black/20 px-3">
          <Row label="Used" value={metrics ? formatMb(metrics.memory?.usedBytes ?? 0) : "—"} />
          <Row label="Total" value={metrics ? formatMb(metrics.memory?.totalBytes ?? 0) : "—"} />
        </div>
      </section>

      {storage && (
        <section className="flex flex-col gap-2">
          <h2 className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Storage</h2>
          <div className="rounded-xl border border-glass-border bg-black/20 px-3">
            <Row label="Mount" value={storage.mountPath} />
            <Row label="Used" value={`${Math.round(storage.usedPercent)}%`} />
            <Row
              label="Free"
              value={`${Math.round(storage.availableBytes / 1024 ** 3)} GB`}
            />
          </div>
        </section>
      )}

      <section className="mb-2 flex flex-col gap-2">
        <h2 className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Containers
        </h2>
        {daemonAvailable === false ? (
          <p className="rounded-xl border border-glass-border bg-black/20 px-3 py-3 text-[12px] text-status-amber">
            The Docker daemon is not reachable.
          </p>
        ) : stats.length === 0 ? (
          <p className="rounded-xl border border-glass-border bg-black/20 px-3 py-3 text-[12px] text-muted-foreground">
            No containers running.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {stats.map((container) => (
              <li
                key={container.id}
                className="rounded-xl border border-glass-border bg-black/20 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      container.state === "running" ? "bg-status-green" : "bg-white/25",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{container.name}</span>
                </div>
                <div className="mt-1 flex gap-4 pl-4 font-mono text-[11px] text-muted-foreground">
                  <span>{container.cpuPercent.toFixed(1)}% cpu</span>
                  <span>{formatMb(container.memoryUsed)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
