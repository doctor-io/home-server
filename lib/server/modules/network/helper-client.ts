import "server-only";

import net from "node:net";
import { serverEnv } from "@/lib/server/env";
import { withServerTiming } from "@/lib/server/logging/logger";
import type {
  ConnectNetworkRequest,
  NetworkEvent,
  NetworkServiceErrorCode,
  NetworkStatus,
  WifiAccessPoint,
} from "@/lib/shared/contracts/network";

type HelperRequest = {
  id: string;
  method: string;
  params?: unknown;
  requestId?: string;
};

type HelperErrorPayload = {
  code?: NetworkServiceErrorCode;
  message?: string;
};

type HelperResponse = {
  id?: string;
  ok?: boolean;
  result?: unknown;
  error?: HelperErrorPayload;
  type?: string;
  event?: NetworkEvent;
};

type HelperCallOptions = {
  requestId?: string;
  timeoutMs?: number;
};

type HelperEventSubscriptionOptions = {
  requestId?: string;
  onError?: (error: unknown) => void;
};

const DEFAULT_TIMEOUT_MS = 8_000;

function parseNetworkServiceErrorCode(value: unknown): NetworkServiceErrorCode {
  if (
    value === "helper_unavailable" ||
    value === "network_manager_unavailable" ||
    value === "auth_failed" ||
    value === "timeout" ||
    value === "invalid_request" ||
    value === "internal_error"
  ) {
    return value;
  }

  return "internal_error";
}

export class NetworkHelperError extends Error {
  readonly code: NetworkServiceErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    options?: {
      code?: NetworkServiceErrorCode;
      statusCode?: number;
      cause?: unknown;
    },
  ) {
    super(message, {
      cause: options?.cause,
    });
    this.name = "NetworkHelperError";
    this.code = options?.code ?? "internal_error";
    this.statusCode = options?.statusCode ?? 500;
  }
}

function mapSocketError(error: unknown) {
  if (!(error instanceof Error)) {
    return new NetworkHelperError("DBus helper request failed");
  }

  const nodeError = error as NodeJS.ErrnoException;
  const code = nodeError.code ?? "";
  if (code === "ENOENT" || code === "ECONNREFUSED") {
    return new NetworkHelperError("DBus helper unavailable", {
      code: "helper_unavailable",
      statusCode: 503,
      cause: error,
    });
  }

  if (code === "ETIMEDOUT") {
    return new NetworkHelperError("DBus helper timeout", {
      code: "timeout",
      statusCode: 504,
      cause: error,
    });
  }

  return new NetworkHelperError(error.message, {
    cause: error,
  });
}

function parseJsonLine(line: string): HelperResponse | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as HelperResponse;
  } catch {
    return null;
  }
}

async function callHelper<T>(
  method: string,
  params: unknown,
  options?: HelperCallOptions,
) {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestId = options?.requestId;
  const callId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return withServerTiming(
    {
      // Keep DBus call telemetry available in debug logs only to avoid high-volume info noise.
      level: "debug",
      layer: "system",
      action: "dbus.network.call",
      requestId,
      meta: {
        method,
      },
    },
    async () =>
      new Promise<T>((resolve, reject) => {
        const socket = net.createConnection({
          path: serverEnv.DBUS_HELPER_SOCKET_PATH,
        });
        let settled = false;
        let buffer = "";

        const request: HelperRequest = {
          id: callId,
          method,
          params,
          requestId,
        };

        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          socket.destroy();
          reject(
            new NetworkHelperError("DBus helper timeout", {
              code: "timeout",
              statusCode: 504,
            }),
          );
        }, timeoutMs);

        const finalize = (fn: () => void) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          socket.end();
          fn();
        };

        socket.on("connect", () => {
          socket.write(`${JSON.stringify(request)}\n`);
        });

        socket.on("data", (chunk) => {
          buffer += chunk.toString("utf8");
          let newline = buffer.indexOf("\n");

          while (newline >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf("\n");

            if (!line) continue;
            const message = parseJsonLine(line);
            if (!message) continue;
            if (message.type === "event") continue;
            if (message.id !== callId) continue;

            if (!message.ok) {
              const helperCode = parseNetworkServiceErrorCode(message.error?.code);
              const statusCode =
                helperCode === "auth_failed"
                  ? 401
                  : helperCode === "helper_unavailable"
                    ? 503
                    : helperCode === "network_manager_unavailable"
                      ? 503
                      : helperCode === "timeout"
                        ? 504
                        : helperCode === "invalid_request"
                          ? 400
                          : 500;

              finalize(() =>
                reject(
                  new NetworkHelperError(
                    message.error?.message ?? "DBus helper request failed",
                    {
                      code: helperCode,
                      statusCode,
                    },
                  ),
                ),
              );
              return;
            }

            finalize(() => resolve(message.result as T));
            return;
          }
        });

        socket.on("error", (error) => {
          finalize(() => reject(mapSocketError(error)));
        });

        socket.on("close", () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(
            new NetworkHelperError("DBus helper closed before response", {
              code: "helper_unavailable",
              statusCode: 503,
            }),
          );
        });
      }),
  );
}

export function isNetworkHelperUnavailableError(error: unknown) {
  return error instanceof NetworkHelperError && error.code === "helper_unavailable";
}

export async function getNetworkStatusFromHelper(options?: HelperCallOptions) {
  return callHelper<NetworkStatus>("network.getStatus", {}, options);
}

export async function scanWifiNetworksFromHelper(options?: HelperCallOptions) {
  return callHelper<WifiAccessPoint[]>("network.scan", {}, options);
}

export async function connectWifiFromHelper(
  input: ConnectNetworkRequest,
  options?: HelperCallOptions,
) {
  return callHelper<NetworkStatus>("network.connect", input, options);
}

export async function disconnectWifiFromHelper(
  input: { iface?: string },
  options?: HelperCallOptions,
) {
  return callHelper<NetworkStatus>("network.disconnect", input, options);
}

export function subscribeToHelperEvents(
  onEvent: (event: NetworkEvent) => void,
  options?: HelperEventSubscriptionOptions,
) {
  const socket = net.createConnection({
    path: serverEnv.DBUS_HELPER_SOCKET_PATH,
  });
  let buffer = "";

  socket.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let newline = buffer.indexOf("\n");

    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");

      if (!line) continue;
      const message = parseJsonLine(line);
      if (!message || message.type !== "event" || !message.event) continue;
      onEvent(message.event);
    }
  });

  socket.on("error", (error) => {
    if (options?.onError) {
      options.onError(mapSocketError(error));
    }
  });

  socket.on("close", () => {
    if (options?.onError) {
      options.onError(
        new NetworkHelperError("DBus helper event stream closed", {
          code: "helper_unavailable",
          statusCode: 503,
        }),
      );
    }
  });

  return () => {
    socket.destroy();
  };
}
