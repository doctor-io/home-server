"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SETTINGS_PANEL_INSET, SETTINGS_PANEL_SHELL } from "@/modules/settings/components/panel/surface";
import { queryKeys } from "@/lib/shared/query-keys";
import type { RawLogEntry, LogSource } from "@/lib/server/modules/logs/service";
import { cn } from "@/lib/utils";

type LogsApiResponse = {
  data: {
    entries: RawLogEntry[];
    source: LogSource;
    truncated: boolean;
    error?: string;
  };
};

async function fetchLogs(source: LogSource): Promise<LogsApiResponse["data"]> {
  const res = await fetch(`/api/v1/logs?source=${source}`);
  if (!res.ok) throw new Error(`Failed to load ${source} logs`);
  const json = (await res.json()) as LogsApiResponse;
  return json.data;
}

const TABS: { id: LogSource; label: string }[] = [
  { id: "homeio", label: "Homeio" },
  { id: "system", label: "System" },
  { id: "docker", label: "Docker" },
];

function levelColor(level?: string) {
  switch (level) {
    case "error": return "text-status-red";
    case "warn": return "text-status-amber";
    case "debug": return "text-muted-foreground/60";
    default: return "text-foreground/80";
  }
}

function levelBadgeColor(level?: string) {
  switch (level) {
    case "error": return "bg-status-red/15 text-status-red";
    case "warn": return "bg-status-amber/15 text-status-amber";
    case "debug": return "bg-secondary text-muted-foreground";
    default: return "bg-primary/10 text-primary";
  }
}

function formatTimestamp(ts?: string) {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts.slice(11, 19) || null;
  }
}

function HomeioLogRow({ entry }: { entry: RawLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const ts = formatTimestamp(entry.timestamp);
  const hasDetail = Boolean(entry.error || entry.message);

  return (
    <div
      className={cn("border-b border-glass-border/40 px-3 py-1.5 transition-colors last:border-0", hasDetail && "cursor-pointer hover:bg-background/30")}
      onClick={() => hasDetail && setExpanded((p) => !p)}
    >
      <div className="flex min-w-0 items-center gap-2">
        {ts && <span className="w-16 shrink-0 font-mono text-2xs text-muted-foreground/60">{ts}</span>}
        {entry.level && (
          <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest", levelBadgeColor(entry.level))}>
            {entry.level}
          </span>
        )}
        {entry.layer && <span className="shrink-0 font-mono text-2xs text-muted-foreground/70">{entry.layer}</span>}
        <span className={cn("truncate font-mono text-2xs", levelColor(entry.level))}>
          {entry.action ?? entry.raw}
        </span>
        {entry.status && <span className="ml-auto shrink-0 text-2xs text-muted-foreground/50">{entry.status}</span>}
      </div>
      {expanded && hasDetail && (
        <div className={cn("ml-18 mt-1.5 rounded-lg p-2", SETTINGS_PANEL_INSET)}>
          {entry.message && <p className="break-all font-mono text-2xs text-foreground/80">{entry.message}</p>}
          {entry.error && <p className="mt-0.5 break-all font-mono text-2xs text-status-red">{entry.error.message}</p>}
        </div>
      )}
    </div>
  );
}

function RawLogRow({ entry }: { entry: RawLogEntry }) {
  const isError = /\b(error|failed|failure|crit|emerg|alert)\b/i.test(entry.raw);
  const isWarn = /\b(warn|warning)\b/i.test(entry.raw);
  return (
    <div className="border-b border-glass-border/40 px-3 py-1 last:border-0">
      <span className={cn("break-all font-mono text-2xs leading-relaxed", isError ? "text-status-red" : isWarn ? "text-status-amber" : "text-foreground/75")}>
        {entry.raw}
      </span>
    </div>
  );
}

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

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dataUpdatedAt, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
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
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const sourceLabel =
    activeSource === "homeio" ? "Homeio Application Logs" :
    activeSource === "system" ? "System Journal" :
    "Docker Daemon Journal";

  return (
    <div className="flex flex-col gap-1.5">
      {/* Tab bar */}
      <div className={cn(SETTINGS_PANEL_INSET, "flex items-center gap-1 px-2 py-2")}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSource(tab.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              activeSource === tab.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {lastUpdated && (
            <span className="text-2xs text-muted-foreground/60">
              {isFetching ? "Refreshing…" : `Updated ${lastUpdated}`}
            </span>
          )}
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            onClick={handleDownload}
            disabled={!data?.entries?.length}
            className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download
          </button>
        </div>
      </div>

      {/* Log output */}
      <div className={cn(SETTINGS_PANEL_SHELL, "flex flex-col overflow-hidden")} style={{ height: "360px" }}>
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-glass-border/50 px-3 py-1.5">
          <span className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{sourceLabel}</span>
          <div className="flex items-center gap-2">
            {data?.truncated ? (
              <span className="text-2xs text-status-amber">Showing last 500 lines</span>
            ) : data?.entries?.length ? (
              <span className="text-2xs text-muted-foreground/50">{data.entries.length} entries</span>
            ) : null}
            <button
              onClick={() => setAutoScroll((p) => !p)}
              className={cn(
                "rounded px-1.5 py-0.5 text-2xs transition-colors",
                autoScroll ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
            </button>
          </div>
        </div>

        {/* Scroll area */}
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
          {data?.error ? (
            <div className="flex h-full items-center justify-center">
              <span className="px-6 text-center text-xs text-status-amber">{data.error}</span>
            </div>
          ) : !data || data.entries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-muted-foreground">{isFetching ? "Loading logs…" : "No log entries found"}</span>
            </div>
          ) : activeSource === "homeio" ? (
            data.entries.map((entry, i) => <HomeioLogRow key={i} entry={entry} />)
          ) : (
            data.entries.map((entry, i) => <RawLogRow key={i} entry={entry} />)
          )}
        </div>
      </div>
    </div>
  );
}
