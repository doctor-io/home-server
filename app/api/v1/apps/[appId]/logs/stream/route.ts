import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  createDockerLogParser,
  detectLogLevel,
  streamDockerContainerLogs,
} from "@/lib/server/modules/docker/logs";
import { toSseChunk } from "@/lib/server/realtime/sse";
import { serverEnv } from "@/lib/server/env";

export const runtime = "nodejs";

/** Soft cap on concurrent log stream connections. */
const MAX_APP_LOG_CONNECTIONS = 20;
let activeAppLogConnections = 0;

type Context = {
  params: Promise<{ appId: string }>;
};

/**
 * GET /api/v1/apps/[appId]/logs/stream
 *
 * Server-Sent Events stream for real-time container logs.
 * Each event: `event: log.line` with payload `{ timestamp, stream, level, message }`.
 */
export async function GET(request: Request, context: Context) {
  if (activeAppLogConnections >= MAX_APP_LOG_CONNECTIONS) {
    return new Response(
      JSON.stringify({ error: "Too many log stream connections", code: "rate_limited" }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const { appId } = await context.params;
  const requestId = createRequestId();

  const containerName = new URL(request.url).searchParams.get("container");

  if (!containerName) {
    return new Response(
      JSON.stringify({ error: "Missing container query parameter", code: "no_container" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
  activeAppLogConnections++;

  return withServerTiming(
    {
      layer: "api",
      action: "apps.logs.stream.connect",
      requestId,
      meta: { appId, containerName },
    },
    async () => {
      const encoder = new TextEncoder();

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let closed = false;
          const connectedAt = performance.now();

          function pushChunk(chunk: string) {
            if (!closed) controller.enqueue(encoder.encode(chunk));
          }

          const heartbeatInterval = setInterval(() => {
            if (closed) return;
            pushChunk(
              toSseChunk("heartbeat", { timestamp: new Date().toISOString() }),
            );
          }, serverEnv.SSE_HEARTBEAT_MS);

          function close() {
            if (closed) return;
            closed = true;
            clearInterval(heartbeatInterval);
            activeAppLogConnections--;
            try {
              controller.close();
            } catch {}
            logServerAction({
              layer: "realtime",
              action: "apps.logs.stream.disconnect",
              status: "success",
              requestId,
              meta: { appId, containerName },
              durationMs: Number((performance.now() - connectedAt).toFixed(2)),
            });
          }

          request.signal.addEventListener("abort", close);

          try {
            const dockerStream = await streamDockerContainerLogs(containerName);

            // Destroy the Docker stream when the client disconnects
            request.signal.addEventListener("abort", () => {
              dockerStream.destroy();
            });

            const processChunk = createDockerLogParser((line) => {
              if (closed) return;
              pushChunk(
                toSseChunk(
                  "log.line",
                  {
                    timestamp: line.timestamp,
                    stream: line.stream,
                    level: detectLogLevel(line.message),
                    message: line.message,
                  },
                  { id: Date.now().toString() },
                ),
              );
            });

            dockerStream.on("data", processChunk);

            dockerStream.on("end", () => {
              if (!closed) {
                pushChunk(toSseChunk("log.end", { message: "Stream ended" }));
              }
              close();
            });

            dockerStream.on("error", (error) => {
              logServerAction({
                level: "error",
                layer: "realtime",
                action: "apps.logs.stream.docker-error",
                status: "error",
                requestId,
                meta: { appId, containerName },
                error,
              });
              if (!closed) {
                pushChunk(
                  toSseChunk("log.error", { message: "Log stream error" }),
                );
              }
              close();
            });
          } catch (error) {
            logServerAction({
              level: "error",
              layer: "realtime",
              action: "apps.logs.stream.start-error",
              status: "error",
              requestId,
              meta: { appId, containerName },
              error,
            });
            pushChunk(
              toSseChunk("log.error", {
                message: "Failed to connect to container logs",
              }),
            );
            close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    },
  );
}
