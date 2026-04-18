"use client";

import {
  ArrowDown,
  Download,
  RefreshCw,
  ScrollText,
  Search,
  X,
} from "@/components/icons/platform-icons";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { BADGE_SURFACE, PANEL_INSET } from "@/lib/ui/surface-tokens";
import { cn } from "@/lib/utils";
import type { AppActionTarget } from "@/modules/apps/components/app-grid-presenters";
import { useCallback, useEffect, useRef, useState } from "react";

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
  ERROR: "bg-status-red/15 text-status-red border-status-red/25",
  WARN: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  INFO: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  DEBUG: "bg-muted/30 text-muted-foreground border-muted/40",
};

const LEVEL_TEXT: Record<LogLevel, string> = {
  ERROR: "text-status-red",
  WARN: "text-yellow-300",
  INFO: "text-blue-300",
  DEBUG: "text-muted-foreground",
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
  const [isConnected, setIsConnected] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  const openStream = useCallback((appId: string, append = false) => {
    esRef.current?.close();
    setStreamError(null);
    setStreamEnded(false);
    setIsConnected(false);
    if (!append) {
      lineIdCounter = 0;
      setLines([]);
      setAutoScroll(true);
    }

    const es = new EventSource(`/api/v1/apps/${appId}/logs/stream`);
    esRef.current = es;

    es.addEventListener("log.line", (event) => {
      setIsConnected(true);
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
      setIsConnected(false);
      es.close();
    });

    es.addEventListener("log.error", (event) => {
      try {
        const data = JSON.parse(event.data) as { message: string };
        setStreamError(data.message);
      } catch {
        setStreamError("Log stream error");
      }
      setIsConnected(false);
      es.close();
    });

    es.onerror = () => {
      setStreamError("Connection to log stream lost");
      setIsConnected(false);
      es.close();
    };
  }, []);

  useEffect(() => {
    if (!target) {
      setLines([]);
      setSearch("");
      setAutoScroll(true);
      setStreamError(null);
      setStreamEnded(false);
      setIsConnected(false);
      return;
    }
    openStream(target.appId);
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [target, openStream]);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "instant" });
    }
  }, [lines, autoScroll]);

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

  const handleReconnect = useCallback(() => {
    if (!target) return;
    openStream(target.appId, true);
  }, [target, openStream]);

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
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 p-0 w-[92vw] sm:w-[92vw] sm:max-w-5xl h-[82vh] bg-popover/96 border-glass-border backdrop-blur-2xl overflow-hidden shadow-2xl shadow-black/45"
      >
        <VisuallyHidden>
          <DialogTitle>{target?.appName ?? "App"} — Logs</DialogTitle>
        </VisuallyHidden>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-glass-border/60 shrink-0">
          <ScrollText className="size-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              {target?.appName ?? "App"} — Logs
            </span>
          </div>

          {/* Search */}
          <div
            className={cn(PANEL_INSET, "relative flex items-center px-2.5 h-7")}
          >
            <Search className="size-3 text-muted-foreground pointer-events-none shrink-0" />
            <input
              type="text"
              placeholder="Filter logs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent pl-2 pr-1 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none w-40"
            />
          </div>

          {/* Auto-scroll resume */}
          {!autoScroll && (
            <button
              onClick={resumeScroll}
              className={cn(
                BADGE_SURFACE,
                "flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
              )}
            >
              <ArrowDown className="size-3" />
              Resume
            </button>
          )}

          {/* Download */}
          <button
            onClick={downloadLogs}
            disabled={lines.length === 0}
            title="Download logs"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Download className="size-3.5" />
          </button>

          {/* Stream status */}
          <div
            className={cn(
              BADGE_SURFACE,
              "flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isConnected
                  ? "bg-status-green animate-pulse"
                  : streamEnded
                    ? "bg-muted-foreground"
                    : streamError
                      ? "bg-status-red"
                      : "bg-muted-foreground/40",
              )}
            />
            <span className="tabular-nums">{lines.length} lines</span>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Error banner */}
        {streamError && (
          <div className="flex items-center gap-3 px-4 py-2.5 text-xs bg-status-red/8 border-b border-status-red/20 shrink-0">
            <span className="size-1.5 rounded-full bg-status-red shrink-0" />
            <span className="text-status-red flex-1">{streamError}</span>
            <button
              onClick={handleReconnect}
              className={cn(
                BADGE_SURFACE,
                "flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
              )}
            >
              <RefreshCw className="size-3" />
              Reconnect
            </button>
          </div>
        )}

        {/* Log area */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-3 bg-black/60"
        >
          {filteredLines.length === 0 && !streamError ? (
            <p className="text-xs text-muted-foreground/50 mt-4 text-center">
              {search.trim() ? "No matching log lines." : "Waiting for logs…"}
            </p>
          ) : (
            <div className="space-y-px">
              {filteredLines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-start gap-2 font-mono text-xs leading-relaxed"
                >
                  {/* Timestamp */}
                  <span className="shrink-0 whitespace-nowrap text-muted-foreground/40 select-none w-28">
                    {formatTimestamp(line.timestamp)}
                  </span>

                  {/* Level badge */}
                  {line.level ? (
                    <span
                      className={cn(
                        "shrink-0 px-1 py-px text-[10px] font-semibold rounded border leading-none",
                        LEVEL_CLASSES[line.level],
                      )}
                    >
                      {line.level}
                    </span>
                  ) : line.stream === "stderr" ? (
                    <span className="shrink-0 px-1 py-px text-[10px] font-semibold rounded border leading-none bg-status-red/15 text-status-red border-status-red/25">
                      ERR
                    </span>
                  ) : (
                    <span className="shrink-0 w-9.75" />
                  )}

                  {/* Message */}
                  <span
                    className={cn(
                      "break-all",
                      line.level
                        ? LEVEL_TEXT[line.level]
                        : line.stream === "stderr"
                          ? "text-status-red/80"
                          : "text-green-100/80",
                    )}
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
          <div className="flex items-center gap-3 px-4 py-2 border-t border-glass-border/60 shrink-0">
            <span className="text-xs text-muted-foreground/60 flex-1">
              Stream ended — container stopped or log tail reached.
            </span>
            <button
              onClick={handleReconnect}
              className={cn(
                BADGE_SURFACE,
                "flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
              )}
            >
              <RefreshCw className="size-3" />
              Reconnect
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
