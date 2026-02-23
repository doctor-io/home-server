"use client";

import type {
  ClientLogIngestPayload,
  LogLevel,
  LogLayer,
  LogStatus,
  StructuredLogEntry,
} from "@/lib/shared/contracts/logging";

type ClientLogInput = {
  level?: LogLevel;
  layer: LogLayer;
  action: string;
  status?: LogStatus;
  durationMs?: number;
  message?: string;
  requestId?: string;
  meta?: Record<string, unknown>;
  error?: unknown;
};

type ClientTimingOptions = {
  level?: LogLevel;
  layer: LogLayer;
  action: string;
  requestId?: string;
  meta?: Record<string, unknown>;
};

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getClientLogLevel(): LogLevel {
  const raw = process.env.NEXT_PUBLIC_LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }

  return "info";
}

function shouldLog(level: LogLevel) {
  return levelRank[level] >= levelRank[getClientLogLevel()];
}

function serializeError(error: unknown) {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(error),
  };
}

function writeConsole(entry: StructuredLogEntry) {
  const line = JSON.stringify(entry);

  if (entry.level === "error") {
    console.error(line);
    return;
  }

  if (entry.level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

function ingestClientLog(entry: StructuredLogEntry) {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.NEXT_PUBLIC_CLIENT_LOG_INGEST === "false") return;

  const payload: ClientLogIngestPayload = {
    ...entry,
    runtime: "client",
  };

  const json = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([json], { type: "application/json" });
      navigator.sendBeacon("/api/v1/logs", blob);
      return;
    }
  } catch {
    // Ignore beacon failures and fallback to fetch.
  }

  void fetch("/api/v1/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: json,
    keepalive: true,
  }).catch(() => undefined);
}

export function logClientAction(input: ClientLogInput) {
  const level = input.level ?? "info";
  if (!shouldLog(level)) return;

  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    runtime: "client",
    level,
    layer: input.layer,
    action: input.action,
    status: input.status ?? "info",
    durationMs: input.durationMs,
    requestId: input.requestId,
    message: input.message,
    meta: input.meta,
    error: serializeError(input.error),
  };

  writeConsole(entry);
  ingestClientLog(entry);
}

export async function withClientTiming<T>(
  options: ClientTimingOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();

  logClientAction({
    level: options.level ?? "info",
    layer: options.layer,
    action: options.action,
    status: "start",
    requestId: options.requestId,
    meta: options.meta,
  });

  try {
    const result = await fn();

    logClientAction({
      level: options.level ?? "info",
      layer: options.layer,
      action: options.action,
      status: "success",
      requestId: options.requestId,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      meta: options.meta,
    });

    return result;
  } catch (error) {
    logClientAction({
      level: "error",
      layer: options.layer,
      action: options.action,
      status: "error",
      requestId: options.requestId,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      meta: options.meta,
      error,
    });

    throw error;
  }
}
