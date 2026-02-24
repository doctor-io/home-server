#!/usr/bin/env node

import process from "node:process";
import net from "node:net";
import { parseRpcRequest, toErrorPayload } from "./protocol.mjs";
import { SOCKET_GROUP, SOCKET_PATH } from "./config.mjs";
import { log } from "./logger.mjs";
import { HelperServiceError, toCodeFromError } from "./errors.mjs";
import { ensureSocketDirectory, ensureSocketPermissions, safeUnlink } from "./socket-fs.mjs";
import { withTimeout } from "./async-utils.mjs";
import { createNetworkService, decodeSsid } from "./network-service.mjs";

const activeSockets = new Set();
let helperServer = null;

const networkService = createNetworkService({ log });
const {
  attachDbusEventBridge,
  connectNetwork,
  disconnectNetwork,
  getNetworkStatus,
  scanNetworks,
} = networkService;

function broadcastEvent(event) {
  const payload = `${JSON.stringify({
    type: "event",
    event,
  })}\n`;

  for (const socket of activeSockets) {
    if (!socket.writable) continue;
    socket.write(payload);
  }
}

async function handleRpcRequest(request) {
  if (request.method === "network.getStatus") {
    return withTimeout(getNetworkStatus());
  }

  if (request.method === "network.scan") {
    return withTimeout(scanNetworks(), 15_000);
  }

  if (request.method === "network.connect") {
    return withTimeout(connectNetwork(request.params, request.requestId), 20_000);
  }

  if (request.method === "network.disconnect") {
    return withTimeout(disconnectNetwork(request.params), 10_000);
  }

  throw new HelperServiceError("Method not allowed", {
    code: "invalid_request",
    statusCode: 400,
  });
}

async function start() {
  await ensureSocketDirectory(SOCKET_PATH, SOCKET_GROUP);
  await safeUnlink(SOCKET_PATH);

  helperServer = net.createServer((socket) => {
    activeSockets.add(socket);
    let buffer = "";

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");

      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");

        if (!line) continue;

        let parsedRequest = null;
        try {
          parsedRequest = parseRpcRequest(line);
        } catch (error) {
          const helperError = toCodeFromError(error);
          socket.write(
            `${JSON.stringify({
              id: null,
              ok: false,
              error: {
                code: helperError.code,
                message: helperError.message,
              },
            })}\n`,
          );
          continue;
        }

        const startedAt = performance.now();
        log({
          action: "dbus.network.rpc",
          status: "start",
          requestId: parsedRequest.requestId ?? parsedRequest.id,
          meta: {
            method: parsedRequest.method,
          },
        });

        void handleRpcRequest(parsedRequest)
          .then((result) => {
            socket.write(
              `${JSON.stringify({
                id: parsedRequest.id,
                ok: true,
                result,
              })}\n`,
            );

            log({
              action: "dbus.network.rpc",
              status: "success",
              requestId: parsedRequest.requestId ?? parsedRequest.id,
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
              meta: {
                method: parsedRequest.method,
              },
            });
          })
          .catch((error) => {
            const helperError = toCodeFromError(error);
            socket.write(
              `${JSON.stringify({
                id: parsedRequest.id,
                ok: false,
                error: toErrorPayload(helperError),
              })}\n`,
            );

            log({
              level: helperError.statusCode >= 500 ? "error" : "warn",
              action: "dbus.network.rpc",
              status: "error",
              requestId: parsedRequest.requestId ?? parsedRequest.id,
              durationMs: Number((performance.now() - startedAt).toFixed(2)),
              meta: {
                method: parsedRequest.method,
              },
              error: helperError,
            });
          });
      }
    });

    socket.on("error", (error) => {
      log({
        level: "warn",
        action: "dbus.network.socket",
        status: "error",
        message: "Client socket error",
        error,
      });
    });

    socket.on("close", () => {
      activeSockets.delete(socket);
    });
  });

  await new Promise((resolve, reject) => {
    helperServer.once("error", reject);
    helperServer.listen(SOCKET_PATH, resolve);
  });

  await ensureSocketPermissions(SOCKET_PATH, SOCKET_GROUP);

  log({
    action: "dbus.network.helper.start",
    status: "success",
    meta: {
      socketPath: SOCKET_PATH,
      socketGroup: SOCKET_GROUP,
    },
  });

  attachDbusEventBridge(broadcastEvent).catch((error) => {
    const mapped = toCodeFromError(error);
    log({
      level: "warn",
      action: "dbus.network.events.start",
      status: "error",
      message: "DBus event bridge failed to start; helper will continue without events",
      error: mapped,
    });
  });
}

async function shutdown(signal) {
  log({
    action: "dbus.network.helper.stop",
    status: "start",
    message: `Received ${signal}, shutting down helper`,
  });

  if (helperServer) {
    await new Promise((resolve) => {
      helperServer.close(() => resolve(undefined));
    });
  }

  await safeUnlink(SOCKET_PATH);
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

start().catch((error) => {
  const mapped = toCodeFromError(error);
  log({
    level: "error",
    action: "dbus.network.helper.start",
    status: "error",
    message: "Failed to start DBus helper",
    error: mapped,
  });
  process.exit(1);
});

export {
  HelperServiceError,
  connectNetwork,
  decodeSsid,
  disconnectNetwork,
  getNetworkStatus,
  scanNetworks,
  toCodeFromError,
};
