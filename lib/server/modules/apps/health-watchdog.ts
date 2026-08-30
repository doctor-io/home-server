import "server-only";

import { request } from "node:http";
import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";
import type { AppHealthState } from "@/lib/shared/contracts/app-health";

export type ContainerEvent = {
  action: string;
  containerId: string;
  containerName: string | null;
  /** Compose project, which is how a container is traced back to an app. */
  project: string | null;
  exitCode: number | null;
  /** True when the stop came from Homeio or an operator, not from a crash. */
  wasDeliberate: boolean;
  at: Date;
};

type RawEvent = {
  Type?: string;
  Action?: string;
  id?: string;
  time?: number;
  Actor?: { ID?: string; Attributes?: Record<string, string> };
};

/**
 * Parses one line of Docker's event stream. Returns null for anything that is
 * not a container lifecycle event, including the empty keep-alive lines the
 * socket emits.
 */
export function parseContainerEvent(line: string): ContainerEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let raw: RawEvent;
  try {
    raw = JSON.parse(trimmed) as RawEvent;
  } catch {
    return null;
  }

  if (raw.Type !== "container" || !raw.Action) return null;

  // Docker appends detail to some actions, e.g. "health_status: unhealthy"
  const action = raw.Action.split(":")[0].trim();
  const attributes = raw.Actor?.Attributes ?? {};
  const exitCodeRaw = attributes.exitCode;
  const exitCode = exitCodeRaw === undefined ? null : Number.parseInt(exitCodeRaw, 10);

  return {
    action,
    containerId: raw.Actor?.ID ?? raw.id ?? "",
    containerName: attributes.name ?? null,
    project: attributes["com.docker.compose.project"] ?? null,
    exitCode: Number.isFinite(exitCode) ? exitCode : null,
    // Docker marks a deliberate `docker stop` on the die event via this signal
    // attribute; an operator's stop must never look like a crash.
    wasDeliberate: raw.Action === "kill" || attributes.signal === "15",
    at: raw.time ? new Date(raw.time * 1000) : new Date(),
  };
}

/** What an event means for an app's health, independent of any policy. */
export function stateForEvent(event: ContainerEvent): AppHealthState | null {
  switch (event.action) {
    case "start":
      return "healthy";
    case "restart":
      return "restarting";
    case "die":
      // Exit 0 is a clean stop; anything else is a failure worth counting.
      return event.exitCode === 0 ? "unknown" : "unhealthy";
    case "health_status":
      return "unhealthy";
    case "stop":
      return "unknown";
    default:
      return null;
  }
}

/** A crash is an unexpected non-zero exit — not a stop anyone asked for. */
export function isCrash(event: ContainerEvent): boolean {
  return event.action === "die" && !event.wasDeliberate && (event.exitCode ?? 0) !== 0;
}

export type RestartWindow = {
  count: number;
  startedAt: Date | null;
};

/**
 * Rolling count of crashes inside the policy window. Returns the new window and
 * whether the budget is now spent, so the caller decides what to do about it.
 */
export function accumulateRestart(
  window: RestartWindow,
  at: Date,
  windowMinutes: number,
  maxRestarts: number,
): { window: RestartWindow; budgetSpent: boolean } {
  const windowMs = windowMinutes * 60_000;
  const expired =
    window.startedAt === null || at.getTime() - window.startedAt.getTime() > windowMs;

  const next: RestartWindow = expired
    ? { count: 1, startedAt: at }
    : { count: window.count + 1, startedAt: window.startedAt };

  return { window: next, budgetSpent: next.count > maxRestarts };
}

type WatchdogHandle = {
  stop: () => void;
};

/**
 * One subscription to Docker's event stream for the whole system — not a poll
 * per app. Reconnects with backoff, and falls back to nothing more than logging
 * if the socket is unavailable, since observation must never break the server.
 */
export function startHealthWatchdog(options: {
  onEvent: (event: ContainerEvent) => void;
  socketPath?: string;
  enabled?: boolean;
}): WatchdogHandle {
  const enabled = options.enabled ?? serverEnv.HOMEIO_AUTOHEAL;
  if (!enabled) {
    return { stop: () => {} };
  }

  let stopped = false;
  let retryDelayMs = 1_000;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let currentRequest: ReturnType<typeof request> | null = null;

  function connect() {
    if (stopped) return;

    const req = request(
      {
        socketPath: options.socketPath ?? serverEnv.DOCKER_SOCKET_PATH,
        path: "/events?filters=" + encodeURIComponent(JSON.stringify({ type: ["container"] })),
        method: "GET",
        headers: { Host: "docker" },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          res.resume();
          scheduleReconnect();
          return;
        }

        retryDelayMs = 1_000;
        let buffer = "";
        res.setEncoding("utf8");

        res.on("data", (chunk: string) => {
          buffer += chunk;
          // Events arrive as newline-delimited JSON and a chunk can split one,
          // so the tail is kept until its newline arrives.
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const event = parseContainerEvent(line);
            if (event) options.onEvent(event);
          }
        });

        res.on("end", scheduleReconnect);
        res.on("error", scheduleReconnect);
      },
    );

    req.on("error", scheduleReconnect);
    req.end();
    currentRequest = req;
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, retryDelayMs);
    // Never let a reconnect timer hold the event loop open during shutdown —
    // the same mistake the v1.7 pull-progress interval made.
    reconnectTimer.unref?.();
    retryDelayMs = Math.min(retryDelayMs * 2, serverEnv.AUTOHEAL_POLL_INTERVAL_MS);
  }

  connect();
  logServerAction({
    level: "info",
    layer: "system",
    action: "apps.health.watchdog.start",
    message: "Container health watchdog subscribed to Docker events",
  });

  return {
    stop: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      currentRequest?.destroy();
      currentRequest = null;
    },
  };
}
