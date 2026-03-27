"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionDivider } from "@/modules/settings/components/panel/controls";
import {
  SETTINGS_PANEL_INSET,
  SETTINGS_PANEL_SHELL,
} from "@/modules/settings/components/panel/surface";
import { queryKeys } from "@/lib/shared/query-keys";
import type { RawLogEntry, LogSource } from "@/lib/server/modules/logs/service";

// ─── Types ───────────────────────────────────────────────────────────────────

type LogsApiResponse = {
  data: {
    entries: RawLogEntry[];
    source: LogSource;
    truncated: boolean;
    error?: string;
  };
};

// ─── Fetch ───────────────────────────────────────────────────────────────────

async function fetchLogs(source: LogSource): Promise<LogsApiResponse["data"]> {
  const res = await fetch(`/api/v1/logs?source=${source}`);
  if (!res.ok) throw new Error(`Failed to load ${source} logs`);
  const json = (await res.json()) as LogsApiResponse;
  return json.data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS: { id: LogSource; label: string }[] = [
  { id: "homeio", label: "Homeio" },
  { id: "system", label: "System" },
  { id: "docker", label: "Docker" },
];

function levelColor(level?: string) {
  switch (level) {
    case "error":
      return "text-status-red";
    case "warn":
      return "text-status-amber";
    case "debug":
      return "text-muted-foreground/60";
    default:
      return "text-foreground/80";
  }
}

function levelBadgeColor(level?: string) {
  switch (level) {
    case "error":
      return "bg-status-red/15 text-status-red";
    case "warn":
      return "bg-status-amber/15 text-status-amber";
    case "debug":
      return "bg-secondary text-muted-foreground";
    default:
      return "bg-primary/10 text-primary";
  }
}

function formatTimestamp(ts?: string) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts.slice(11, 19) || null;
  }
}

// ─── Log row (structured homeio entry) ───────────────────────────────────────

function HomeioLogRow({ entry }: { entry: RawLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ts = formatTimestamp(entry.timestamp);
  const hasDetail = Boolean(entry.error || entry.message);

  return (
    <div
      className={`border-b border-glass-border/40 last:border-0 px-3 py-1.5 hover:bg-background/30 transition-colors ${
        hasDetail ? "cursor-pointer" : ""
      }`}
      onClick={() => hasDetail && setExpanded((p) => !p)}
    >
      <div className="flex items-center gap-2 min-w-0">
        {ts ? (
          <span className="shrink-0 text-[10px] font-mono text-muted-foreground/60 w-16">
            {ts}
          </span>
        ) : null}
        {entry.level ? (
          <span
            className={`shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${levelBadgeColor(entry.level)}`}
          >
            {entry.level}
          </span>
        ) : null}
        {entry.layer ? (
          <span className="shrink-0 text-[10px] font-mono text-muted-foreground/70">
            {entry.layer}
          </span>
        ) : null}
        <span
          className={`truncate text-[11px] font-mono ${levelColor(entry.level)}`}
        >
          {entry.action || entry.raw}
        </span>
        {entry.status ? (
          <span className="shrink-0 text-[10px] text-muted-foreground/50 ml-auto">
            {entry.status}
          </span>
        ) : null}
      </div>
      {expanded && hasDetail ? (
        <div className={`mt-1.5 ml-18 rounded-lg p-2 ${SETTINGS_PANEL_INSET}`}>
          {entry.message ? (
            <p className="text-[11px] text-foreground/80 font-mono break-all">
              {entry.message}
            </p>
          ) : null}
          {entry.error ? (
            <p className="text-[11px] text-status-red font-mono break-all mt-0.5">
              {entry.error.message}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ─── Raw log row (system / docker) ───────────────────────────────────────────

function RawLogRow({ entry }: { entry: RawLogEntry }) {
  // Rough colorisation based on keywords
  const isError =
    /\b(error|failed|failure|crit|emerg|alert)\b/i.test(entry.raw);
  const isWarn = /\b(warn|warning)\b/i.test(entry.raw);

  const color = isError
    ? "text-status-red"
    : isWarn
      ? "text-status-amber"
      : "text-foreground/75";

  return (
    <div className="border-b border-glass-border/40 last:border-0 px-3 py-1">
      <span
        className={`text-[10.5px] font-mono leading-relaxed break-all ${color}`}
      >
        {entry.raw}
      </span>
    </div>
  );
}

// ─── Main section ─────────────────────────────────────────────────────────────

const REFETCH_INTERVAL = 8_000;

export function LogsSection() {
  const [activeSource, setActiveSource] = useState<LogSource>("homeio");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.logs(activeSource),
    queryFn: () => fetchLogs(activeSource),
    refetchInterval: REFETCH_INTERVAL,
    staleTime: REFETCH_INTERVAL / 2,
  });

  // Auto-scroll to bottom when new data arrives
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dataUpdatedAt, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  function handleDownload() {
    if (!data?.entries) return;
    const text = data.entries.map((e) => e.raw).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `homeio-${activeSource}-logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div className="flex flex-col gap-1">
      <SectionDivider title="Advanced" />

      {/* Source tabs */}
      <div className="flex items-center gap-1 mt-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSource(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeSource === tab.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {lastUpdated ? (
            <span className="text-[10px] text-muted-foreground/60">
              {isFetching ? "Refreshing…" : `Updated ${lastUpdated}`}
            </span>
          ) : null}
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={handleDownload}
            disabled={!data?.entries?.length}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download
          </button>
        </div>
      </div>

      {/* Log output */}
      <div
        className={`${SETTINGS_PANEL_SHELL} mt-1 overflow-hidden flex flex-col`}
        style={{ height: "360px" }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-glass-border/50 shrink-0">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {activeSource === "homeio"
              ? "Homeio Application Logs"
              : activeSource === "system"
                ? "System Journal"
                : "Docker Daemon Journal"}
          </span>
          <div className="flex items-center gap-2">
            {data?.truncated ? (
              <span className="text-[10px] text-status-amber">
                Showing last 500 lines
              </span>
            ) : data?.entries?.length ? (
              <span className="text-[10px] text-muted-foreground/50">
                {data.entries.length} entries
              </span>
            ) : null}
            <button
              onClick={() => setAutoScroll((p) => !p)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                autoScroll
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
            </button>
          </div>
        </div>

        {/* Scroll area */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          {data?.error ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-status-amber text-center px-6">
                {data.error}
              </span>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-xs text-muted-foreground">
                {isFetching ? "Loading logs…" : "No log entries found"}
              </span>
            </div>
          ) : activeSource === "homeio" ? (
            data.entries.map((entry, i) => (
              <HomeioLogRow key={i} entry={entry} />
            ))
          ) : (
            data.entries.map((entry, i) => (
              <RawLogRow key={i} entry={entry} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
