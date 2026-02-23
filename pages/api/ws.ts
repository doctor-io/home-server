import type { IncomingMessage, Server as HttpServer } from "http";
import type { Socket } from "net";
import type { NextApiRequest, NextApiResponse } from "next";
import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";
import { WebSocketServer, type WebSocket } from "ws";

type ServerWithWss = HttpServer & {
  homeioWssInitialized?: boolean;
  homeioWss?: WebSocketServer;
};

type WsApiResponse = NextApiResponse & {
  socket: Socket & {
    server: ServerWithWss;
  };
};

function wireConnection(socket: WebSocket) {
  const requestId = createRequestId();
  const connectedAt = performance.now();

  logServerAction({
    layer: "realtime",
    action: "system.websocket.connection",
    status: "start",
    requestId,
  });

  const sendMetrics = async () => {
    if (socket.readyState !== socket.OPEN) return;

    try {
      const snapshot = await getSystemMetricsSnapshot({ bypassCache: true });
      if (socket.readyState !== socket.OPEN) return;

      socket.send(
        JSON.stringify({
          type: "metrics.updated",
          data: snapshot,
        }),
      );
    } catch (error) {
      logServerAction({
        level: "error",
        layer: "realtime",
        action: "system.websocket.metrics",
        status: "error",
        requestId,
        error,
      });
    }
  };

  void sendMetrics();

  const metricsInterval = setInterval(
    () => {
      void sendMetrics();
    },
    serverEnv.METRICS_PUBLISH_INTERVAL_MS,
  );

  socket.on("message", (rawMessage) => {
    const message = rawMessage.toString();

    logServerAction({
      level: "debug",
      layer: "realtime",
      action: "system.websocket.message",
      status: "info",
      requestId,
      meta: {
        size: message.length,
      },
    });

    if (message === "ping") {
      socket.send(
        JSON.stringify({
          type: "pong",
          data: { timestamp: new Date().toISOString() },
        }),
      );
    }
  });

  socket.on("close", () => {
    clearInterval(metricsInterval);
    logServerAction({
      layer: "realtime",
      action: "system.websocket.connection",
      status: "success",
      requestId,
      durationMs: Number((performance.now() - connectedAt).toFixed(2)),
    });
  });

  socket.on("error", (error) => {
    logServerAction({
      level: "error",
      layer: "realtime",
      action: "system.websocket.connection",
      status: "error",
      requestId,
      durationMs: Number((performance.now() - connectedAt).toFixed(2)),
      error,
    });
  });
}

function setupWss(server: ServerWithWss) {
  if (server.homeioWssInitialized || !serverEnv.WEBSOCKET_ENABLED) return;

  const wss = new WebSocketServer({ noServer: true });

  server.on(
    "upgrade",
    (request: IncomingMessage, socket: Socket, head: Buffer) => {
      if (!request.url?.startsWith("/api/ws")) {
        return;
      }

      wss.handleUpgrade(request, socket, head, (client) => {
        wss.emit("connection", client, request);
      });
    },
  );

  wss.on("connection", (socket) => {
    wireConnection(socket);
  });

  server.homeioWss = wss;
  server.homeioWssInitialized = true;

  logServerAction({
    layer: "realtime",
    action: "system.websocket.server",
    status: "success",
    message: "WebSocket server initialized",
  });
}

export default async function handler(_req: NextApiRequest, res: WsApiResponse) {
  const requestId = createRequestId();
  const server = res.socket?.server;

  if (!server) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.websocket.init",
      status: "error",
      requestId,
      message: "WebSocket server unavailable",
    });

    res.status(500).json({
      ok: false,
      error: "WebSocket server unavailable",
    });
    return;
  }

  try {
    await withServerTiming(
      {
        layer: "api",
        action: "system.websocket.init",
        requestId,
      },
      async () => {
        setupWss(server);
        return Promise.resolve();
      },
    );
  } catch {
    res.status(500).json({
      ok: false,
      error: "WebSocket initialization failed",
    });
    return;
  }

  res.status(200).json({
    ok: true,
    websocketEnabled: serverEnv.WEBSOCKET_ENABLED,
    path: "/api/ws",
  });
}
