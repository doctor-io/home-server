"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ArrowDown,
  Download,
  Pause,
  Play,
  Search,
  ScrollText,
} from "@/components/icons/platform-icons";
import type { AppActionTarget } from "@/modules/apps/components/app-grid-presenters";

type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG";

type LogLine = {
  id: number;
  timestamp: string;
  stream: "stdout" | "stderr";
  level: LogLevel | null;
  message: string;
};

type AppLogsDialogProps = {
  target: AppActionTarget | null;
  onClose: () => void;
};

const LEVEL_CLASSES: Record<LogLevel, string> = {
  ERROR: "bg-status-red/20 text-status-red border-status-red/30",
  WARN:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  INFO:  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DEBUG: "bg-muted/40 text-muted-foreground border-muted/30",
};

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return iso;
  }
}

let lineIdCounter = 0;

export function AppLogsDialog({ target, onClose }: AppLogsDialogProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [search, setSearch] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [streamEnded, setStreamEnded] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Open / close the SSE stream when target changes
  useEffect(() => {
    if (!target) {
      setLines([]);
      setSearch("");
      setAutoScroll(true);
      setStreamError(null);
      setStreamEnded(false);
      return;
    }

    lineIdCounter = 0;
    setLines([]);
    setStreamError(null);
    setStreamEnded(false);
    setAutoScroll(true);

    const es = new EventSource(`/api/v1/apps/${target.appId}/logs/stream`);
    esRef.current = es;

    es.addEventListener("log.line", (event) => {
      try {
        const data = JSON.parse(event.data) as {
          timestamp: string;
          stream: "stdout" | "stderr";
          level: LogLevel | null;
          message: string;
        };
        setLines((prev) => [
          ...prev,
          {
            id: ++lineIdCounter,
            timestamp: data.timestamp,
            stream: data.stream,
            level: data.level,
            message: data.message,
          },
        ]);
      } catch {}
    });

    es.addEventListener("log.end", () => {
      setStreamEnded(true);
    });

    es.addEventListener("log.error", (event) => {
      try {
        const data = JSON.parse(event.data) as { message: string };
        setStreamError(data.message);
      } catch {
        setStreamError("Log stream error");
      }
      es.close();
    });

    es.onerror = () => {
      setStreamError("Connection to log stream lost");
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [target]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [lines, autoScroll]);

  // Detect manual scroll-up → pause auto-scroll
  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const resumeScroll = useCallback(() => {
    setAutoScroll(true);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const downloadLogs = useCallback(() => {
    const text = lines
      .map((l) => `${l.timestamp} [${l.stream.toUpperCase()}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${target?.appId ?? "app"}-logs.log`;
    a.click();
    URL.revokeObjectURL(url);
  }, [lines, target]);

  const filteredLines = search.trim()
    ? lines.filter((l) =>
        l.message.toLowerCase().includes(search.toLowerCase()),
      )
    : lines;

  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 p-0 w-[92vw] sm:w-[92vw] sm:max-w-5xl h-[82vh] bg-popover/98 border-glass-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-glass-border shrink-0">
          <ScrollText className="size-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {target?.appName ?? "App"} — Logs
            </span>
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Filter logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 pr-3 text-xs rounded-md bg-secondary/60 border border-glass-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
            />
          </div>

          {/* Auto-scroll resume button */}
          {!autoScroll && (
            <button
              onClick={resumeScroll}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-secondary/60 border border-glass-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowDown className="size-3" />
              Resume scroll
            </button>
          )}

          {/* Download */}
          <button
            onClick={downloadLogs}
            disabled={lines.length === 0}
            title="Download logs"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="size-4" />
          </button>

          {/* Stream status indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {streamEnded || streamError ? (
              <Pause className="size-3 text-muted-foreground" />
            ) : (
              <Play className="size-3 text-status-green animate-pulse" />
            )}
            <span>{lines.length} lines</span>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {streamError && (
          <div className="px-4 py-2 text-xs text-status-red bg-status-red/10 border-b border-status-red/20 shrink-0">
            {streamError}
          </div>
        )}

        {/* Log area */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-black/80 px-4 py-3"
        >
          {filteredLines.length === 0 && !streamError ? (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              {search.trim() ? "No matching log lines." : "Waiting for logs…"}
            </p>
          ) : (
            <div className="space-y-px">
              {filteredLines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-start gap-2 font-mono text-xs leading-relaxed group"
                >
                  {/* Timestamp */}
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground/60 select-none w-[92px]">
                    {formatTimestamp(line.timestamp)}
                  </span>

                  {/* Level badge */}
                  {line.level ? (
                    <span
                      className={`shrink-0 px-1 py-px text-2xs font-semibold rounded border leading-none ${LEVEL_CLASSES[line.level]}`}
                    >
                      {line.level}
                    </span>
                  ) : (
                    <span className="shrink-0 w-[39px]" />
                  )}

                  {/* stderr indicator */}
                  {line.stream === "stderr" && !line.level && (
                    <span className="shrink-0 px-1 py-px text-2xs font-semibold rounded border leading-none bg-status-red/20 text-status-red border-status-red/30">
                      ERR
                    </span>
                  )}

                  {/* Message */}
                  <span
                    className={`break-all ${
                      line.stream === "stderr" && !line.level
                        ? "text-status-red/80"
                        : line.level === "ERROR"
                          ? "text-status-red"
                          : line.level === "WARN"
                            ? "text-yellow-300"
                            : "text-green-100/90"
                    }`}
                  >
                    {line.message}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        {streamEnded && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-t border-glass-border bg-glass shrink-0">
            Stream ended — container stopped or log tail reached.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
