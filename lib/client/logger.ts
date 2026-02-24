"use client";

import type {
  LogLevel,
  LogLayer,
  LogStatus,
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

export function logClientAction(_input: ClientLogInput) {
  // Client logging is intentionally disabled in all environments.
}

export async function withClientTiming<T>(
  options: ClientTimingOptions,
  fn: () => Promise<T>,
): Promise<T> {
  void options;

  try {
    return await fn();
  } catch (error) {
    throw error;
  }
}
