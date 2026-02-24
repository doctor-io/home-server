export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogLayer =
  | "api"
  | "db"
  | "hook"
  | "realtime"
  | "service"
  | "system";

export type LogStatus = "start" | "success" | "error" | "info";

export type StructuredLogEntry = {
  timestamp: string;
  runtime: "server" | "client";
  level: LogLevel;
  layer: LogLayer;
  action: string;
  status: LogStatus;
  durationMs?: number;
  requestId?: string;
  message?: string;
  meta?: Record<string, unknown>;
  error?: {
    name?: string;
    message: string;
    stack?: string;
  };
};
