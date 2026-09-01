"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, Cpu, HardDrive, MemoryStick } from "@/components/icons/platform-icons";
import { useDockerStats } from "@/modules/system/hooks/useDockerStats";
import { useSystemMetrics } from "@/modules/system/hooks/useSystemMetrics";
import { cn } from "@/lib/utils";

/** ~4 minutes at the default 2s publish interval, as on the desktop Monitor. */
const HISTORY_CAPACITY = 120;

type Series = "cpu" | "memory";

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

/** Compact enough to sit on one line in a chip: 47.2 GB, not 48294 MB. */
function formatSize(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
  return formatMb(bytes);
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours}h ${minutes}m`;
}

/**
 * A smooth path through the samples.
 *
 * Catmull-Rom control points rather than straight segments: the line is read as
 * a shape at this size, and polyline corners on a 2-second sample interval look
 * like noise the machine is not actually producing.
 */
function smoothPath(values: number[], scaleMax: number) {
  if (values.length === 0) return "";

  const points = values.map((value, index) => ({
    x: values.length === 1 ? 0 : (index / (values.length - 1)) * 100,
    y: 100 - (Math.max(0, Math.min(scaleMax, value)) / scaleMax) * 100,
  }));

  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  }

  let path = `M${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

/**
 * The history chart. Drawn in a 0-100 box and stretched to fit, so the samples
 * need no measurement of the element — `non-scaling-stroke` keeps the line an
 * even weight under that stretch, and the marker is an HTML dot on top rather
 * than an SVG circle, which the same stretch would turn into an ellipse.
 */
function HistoryChart({ values, unit }: { values: number[]; unit: string }) {
  // Anchored at zero, but with a ceiling that follows the data: a machine
  // idling at 4% drawn against a fixed 0-100 axis is a flat line on the floor,
  // which says less than it could. The floor of 20 stops a quiet minute from
  // being magnified into a mountain range.
  const scaleMax = useMemo(
    () => Math.max(20, Math.ceil((Math.max(...values, 0) * 1.25) / 5) * 5),
    [values],
  );
  const path = useMemo(() => smoothPath(values, scaleMax), [values, scaleMax]);
  const latest = values.at(-1) ?? 0;
  const markerY = 100 - (Math.max(0, Math.min(scaleMax, latest)) / scaleMax) * 100;
  // The newest sample sits on the right edge, where half the dot would be
  // clipped away; pull it in by its own radius rather than shortening the line.
  const markerLeft = values.length > 1 ? "calc(100% - 0.6rem)" : "50%";

  if (values.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-3xl bg-white/4">
        <span className="text-[12px] text-muted-foreground">Collecting…</span>
      </div>
    );
  }

  return (
    <div className="relative h-40 overflow-hidden rounded-3xl bg-white/4">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 size-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="phone-history-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(255 255 255)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(255 255 255)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <path d={`${path} L100 100 L0 100 Z`} fill="url(#phone-history-fill)" />
        <path
          d={path}
          fill="none"
          stroke="rgb(255 255 255)"
          strokeOpacity="0.55"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* The reading floats clear of its point rather than sitting on the
          line, which it would otherwise cover at exactly the moment you are
          reading it. It flips below when the line is near the ceiling. */}
      <div
        className={cn(
          "pointer-events-none absolute -translate-x-[88%]",
          markerY > 30 ? "-translate-y-[130%]" : "translate-y-[30%]",
        )}
        style={{ left: markerLeft, top: `${markerY}%` }}
      >
        <div className="rounded-xl bg-[#1a1d22] px-2.5 py-1.5 text-center shadow-lg shadow-black/40 ring-1 ring-white/8">
          <p className="text-[9px] whitespace-nowrap text-muted-foreground">now</p>
          <p className="text-[12px] font-medium tabular-nums">
            {Math.round(latest)}
            {unit}
          </p>
        </div>
      </div>

      <span
        aria-hidden="true"
        className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary/20"
        style={{ left: markerLeft, top: `${markerY}%` }}
      />
    </div>
  );
}

/** Colour only where it means something: amber at 75%, red at 90%. */
function toneFor(percent: number | null) {
  if (percent === null) return "";
  if (percent >= 90) return "text-status-red";
  if (percent >= 75) return "text-status-amber";
  return "";
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[4.75rem] flex-1 flex-col items-center gap-1.5 rounded-2xl bg-white/4 px-2 py-3">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-[14px] font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  percent = null,
}: {
  icon: typeof Activity;
  value: string;
  label: string;
  percent?: number | null;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <Icon className="size-4 opacity-60 grayscale" />
      <span className={cn("text-[14px] font-medium tabular-nums", toneFor(percent))}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

export function PhoneMonitor() {
  const { data: metrics } = useSystemMetrics();
  const { stats, daemonAvailable } = useDockerStats();
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [series, setSeries] = useState<Series>("cpu");

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
  const temperature = metrics?.temperature?.mainCelsius;

  const isCpu = series === "cpu";
  const HeadlineIcon = isCpu ? Cpu : MemoryStick;
  const headline = isCpu
    ? (metrics?.cpu?.normalizedPercent ?? null)
    : (metrics?.memory?.usedPercent ?? null);

  const chips = isCpu
    ? [
        { label: "Load 1m", value: metrics ? (metrics.cpu?.oneMinute ?? 0).toFixed(2) : "—" },
        { label: "Load 5m", value: metrics ? (metrics.cpu?.fiveMinute ?? 0).toFixed(2) : "—" },
        { label: "Load 15m", value: metrics ? (metrics.cpu?.fifteenMinute ?? 0).toFixed(2) : "—" },
        {
          label: "Temp",
          value:
            temperature !== null && temperature !== undefined
              ? `${Math.round(temperature)}°C`
              : "—",
        },
      ]
    : [
        { label: "Used", value: metrics ? formatSize(metrics.memory?.usedBytes ?? 0) : "—" },
        { label: "Free", value: metrics ? formatSize(metrics.memory?.freeBytes ?? 0) : "—" },
        { label: "Total", value: metrics ? formatSize(metrics.memory?.totalBytes ?? 0) : "—" },
        {
          label: "Containers",
          value: daemonAvailable === false ? "—" : String(stats.length),
        },
      ];

  return (
    <div className="flex flex-col gap-3.5">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Monitoring</p>
          <h1 className="truncate text-lg font-medium">{metrics?.hostname ?? "This server"}</h1>
        </div>
        <Activity className="mt-1 size-5 opacity-40" />
      </header>

      {/* The headline reading, sized to be read from across the room — the
          number you open this screen for. */}
      <section className="rounded-3xl bg-white/5 px-5 py-4">
        <p className="text-[11px] text-muted-foreground">
          {metrics ? `Up ${formatUptime(metrics.uptimeSeconds)}` : "Reading…"}
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium">{isCpu ? "CPU load" : "Memory in use"}</p>
            <p className="mt-1 text-[2.75rem] leading-none font-medium tabular-nums">
              {headline === null ? "—" : Math.round(headline)}
              {headline !== null && <span className="text-2xl">%</span>}
            </p>
          </div>
          <HeadlineIcon className="size-14 opacity-40" />
        </div>
      </section>

      <section className="flex items-stretch rounded-3xl bg-white/5 px-2 py-3.5">
        <Stat
          icon={MemoryStick}
          value={metrics ? `${Math.round(metrics.memory?.usedPercent ?? 0)}%` : "—"}
          label="Memory"
          percent={metrics?.memory?.usedPercent ?? null}
        />
        <Stat
          icon={HardDrive}
          value={storage ? `${Math.round(storage.usedPercent)}%` : "—"}
          label="Storage"
          percent={storage?.usedPercent ?? null}
        />
        <Stat
          icon={CalendarClock}
          value={metrics ? formatUptime(metrics.uptimeSeconds) : "—"}
          label="Uptime"
        />
      </section>

      {/* Tabs pick the series for everything below them — the chips are that
          series' supporting numbers, the chart is its history. */}
      <div className="flex flex-col gap-2.5">
        <div className="flex gap-5">
          {(["cpu", "memory"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSeries(option)}
              className="flex flex-col items-center gap-1.5 pt-1"
            >
              <span
                className={cn(
                  "text-[13px] transition-colors",
                  series === option ? "font-medium" : "text-muted-foreground",
                )}
              >
                {option === "cpu" ? "CPU" : "Memory"}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "size-1 rounded-full transition-colors",
                  series === option ? "bg-primary" : "bg-transparent",
                )}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {chips.map((chip) => (
            <Chip key={chip.label} label={chip.label} value={chip.value} />
          ))}
        </div>

        <HistoryChart values={isCpu ? cpuHistory : memHistory} unit="%" />
      </div>

      <section className="mb-2 flex flex-col gap-2">
        <h2 className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Containers
        </h2>
        {daemonAvailable === false ? (
          <p className="rounded-2xl bg-white/4 px-3.5 py-3 text-[12px] text-status-amber">
            The Docker daemon is not reachable.
          </p>
        ) : stats.length === 0 ? (
          <p className="rounded-2xl bg-white/4 px-3.5 py-3 text-[12px] text-muted-foreground">
            No containers running.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-3xl bg-white/4">
            {stats.map((container) => (
              <li
                key={container.id}
                className="flex items-center gap-3 border-b border-white/5 px-3.5 py-3 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    container.state === "running" ? "bg-status-green" : "bg-white/25",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[13px]">{container.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {container.cpuPercent.toFixed(1)}% · {formatMb(container.memoryUsed)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
