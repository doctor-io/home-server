import "server-only";

import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "@/lib/server/env";
import type {
  ClientLogIngestPayload,
  LogLevel,
  LogLayer,
  LogStatus,
  StructuredLogEntry,
} from "@/lib/shared/contracts/logging";

type ServerLogInput = {
  level?: LogLevel;
  layer: LogLayer;
  action: string;
  status?: LogStatus;
  durationMs?: number;
  requestId?: string;
  message?: string;
  meta?: Record<string, unknown>;
  error?: unknown;
  runtime?: "server" | "client";
};

type ServerTimingOptions = {
  level?: LogLevel;
  layer: LogLayer;
  action: string;
  requestId?: string;
  meta?: Record<string, unknown>;
  onSuccessMeta?: (result: unknown) => Record<string, unknown> | undefined;
  onErrorMeta?: (error: unknown) => Record<string, unknown> | undefined;
};

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let writeQueue: Promise<void> = Promise.resolve();
let logDirectoryReady = false;

function getServerLogLevel(): LogLevel {
  const raw = serverEnv.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }

  return "info";
}

function shouldLog(level: LogLevel) {
  return levelRank[level] >= levelRank[getServerLogLevel()];
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

function getLogFilePath() {
  const filePath = serverEnv.LOG_FILE_PATH || "logs/home-server.log";
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
}

async function ensureLogDirectory() {
  if (logDirectoryReady) return;

  await mkdir(path.dirname(getLogFilePath()), { recursive: true });
  logDirectoryReady = true;
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

function writeToFile(entry: StructuredLogEntry) {
  if (process.env.NODE_ENV === "test") return;
  if (serverEnv.LOG_TO_FILE === false) return;

  const line = `${JSON.stringify(entry)}\n`;
  const filePath = getLogFilePath();

  writeQueue = writeQueue
    .then(async () => {
      await ensureLogDirectory();
      await appendFile(filePath, line, "utf8");
    })
    .catch((error) => {
      const fallback: StructuredLogEntry = {
        timestamp: new Date().toISOString(),
        runtime: "server",
        level: "error",
        layer: "system",
        action: "log.file.write",
        status: "error",
        message: "Failed writing structured log to file",
        error: serializeError(error),
      };

      console.error(JSON.stringify(fallback));
    });
}

export function logServerAction(input: ServerLogInput) {
  const level = input.level ?? "info";
  if (!shouldLog(level)) return;

  const entry: StructuredLogEntry = {
    timestamp: new Date().toISOString(),
    runtime: input.runtime ?? "server",
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
  writeToFile(entry);
}

export async function withServerTiming<T>(
  options: ServerTimingOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();

  logServerAction({
    level: options.level ?? "info",
    layer: options.layer,
    action: options.action,
    status: "start",
    requestId: options.requestId,
    meta: options.meta,
  });

  try {
    const result = await fn();

    logServerAction({
      level: options.level ?? "info",
      layer: options.layer,
      action: options.action,
      status: "success",
      requestId: options.requestId,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      meta: {
        ...options.meta,
        ...(options.onSuccessMeta ? options.onSuccessMeta(result) : {}),
      },
    });

    return result;
  } catch (error) {
    logServerAction({
      level: "error",
      layer: options.layer,
      action: options.action,
      status: "error",
      requestId: options.requestId,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      meta: {
        ...options.meta,
        ...(options.onErrorMeta ? options.onErrorMeta(error) : {}),
      },
      error,
    });

    throw error;
  }
}

export function ingestClientLog(payload: ClientLogIngestPayload) {
  logServerAction({
    runtime: "client",
    level: payload.level,
    layer: payload.layer,
    action: payload.action,
    status: payload.status,
    durationMs: payload.durationMs,
    requestId: payload.requestId,
    message: payload.message,
    meta: payload.meta,
    error: payload.error,
  });
}

export function createRequestId() {
  return randomUUID();
}

export async function flushServerLogsForTests() {
  await writeQueue;
}
