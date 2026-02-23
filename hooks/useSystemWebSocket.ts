"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { logClientAction } from "@/lib/client/logger";
import type { SystemMetricsSnapshot } from "@/lib/shared/contracts/system";
import { queryKeys } from "@/lib/shared/query-keys";

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

type WsEnvelope = {
  type: string;
  data?: unknown;
};

export function useSystemWebSocket(enabled = false) {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(
    enabled ? "connecting" : "idle",
  );

  const send = useCallback((message: string) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      logClientAction({
        level: "warn",
        layer: "hook",
        action: "hooks.useSystemWebSocket.send",
        status: "error",
        message: "WebSocket is not open",
      });
      return false;
    }

    socket.send(message);

    logClientAction({
      level: "debug",
      layer: "hook",
      action: "hooks.useSystemWebSocket.send",
      status: "success",
      meta: {
        size: message.length,
      },
    });

    return true;
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let disposed = false;
    const connectedAt = performance.now();

    logClientAction({
      layer: "hook",
      action: "hooks.useSystemWebSocket.connection",
      status: "start",
      meta: {
        endpoint: "/api/ws",
      },
    });

    const connect = async () => {
      try {
        await fetch("/api/ws", { method: "GET", cache: "no-store" });
      } catch (error) {
        setStatus("disconnected");

        logClientAction({
          level: "error",
          layer: "hook",
          action: "hooks.useSystemWebSocket.connection",
          status: "error",
          durationMs: Number((performance.now() - connectedAt).toFixed(2)),
          error,
        });
        return;
      }

      if (disposed) return;

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const socket = new WebSocket(`${protocol}://${window.location.host}/api/ws`);
      socketRef.current = socket;
      setStatus("connecting");

      socket.onopen = () => {
        setStatus("connected");

        logClientAction({
          layer: "hook",
          action: "hooks.useSystemWebSocket.connection",
          status: "success",
          durationMs: Number((performance.now() - connectedAt).toFixed(2)),
        });
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as WsEnvelope;

          if (parsed.type === "metrics.updated" && parsed.data) {
            queryClient.setQueryData(
              queryKeys.systemMetrics,
              parsed.data as SystemMetricsSnapshot,
            );
          }

          logClientAction({
            level: "debug",
            layer: "hook",
            action: "hooks.useSystemWebSocket.message",
            status: "info",
            meta: {
              type: parsed.type,
            },
          });
        } catch {
          // Ignore malformed frames from clients/tools that may share endpoint.
        }
      };

      socket.onerror = () => {
        setStatus("disconnected");

        logClientAction({
          level: "error",
          layer: "hook",
          action: "hooks.useSystemWebSocket.connection",
          status: "error",
          durationMs: Number((performance.now() - connectedAt).toFixed(2)),
          message: "WebSocket error",
        });
      };

      socket.onclose = () => {
        setStatus("disconnected");

        logClientAction({
          layer: "hook",
          action: "hooks.useSystemWebSocket.connection",
          status: "info",
          durationMs: Number((performance.now() - connectedAt).toFixed(2)),
          message: "WebSocket closed",
        });
      };
    };

    void connect();

    return () => {
      disposed = true;
      const socket = socketRef.current;
      socketRef.current = null;

      if (socket && socket.readyState < WebSocket.CLOSING) {
        socket.close();
      }

      setStatus("idle");
    };
  }, [enabled, queryClient]);

  return {
    status,
    send,
  };
}
