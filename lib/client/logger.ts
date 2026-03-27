"use client";

import type {
  LogLayer,
  LogLevel,
  LogStatus,
} from "@/lib/shared/contracts/logging";

type _ClientLogInput = {
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
