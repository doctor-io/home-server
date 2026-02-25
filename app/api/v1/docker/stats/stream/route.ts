import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAllContainersStats } from "@/lib/server/modules/docker/stats";
import { toSseChunk } from "@/lib/server/realtime/sse";

export const runtime = "nodejs";

/**
 * GET /api/v1/docker/stats/stream
 *
 * Server-Sent Events stream for real-time Docker container stats
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const requestId = createRequestId();

  return withServerTiming(
    {
      layer: "api",
      action: "docker.stats.stream.connect",
      requestId,
    },
    async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let closed = false;
          const connectedAt = performance.now();

          const pushStats = async () => {
            if (closed) return;

            try {
              const stats = await getAllContainersStats();
              if (closed) return;

              controller.enqueue(
                encoder.encode(
                  toSseChunk("stats.updated", stats, {
                    id: Date.now().toString(),
                  }),
                ),
              );
            } catch (error) {
              logServerAction({
                level: "error",
                layer: "realtime",
                action: "docker.stats.stream.push",
                status: "error",
                requestId,
                error,
              });
            }
          };

          void pushStats();

          // Update stats every 2 seconds
          const statsInterval = setInterval(
            () => {
              void pushStats();
            },
            serverEnv.METRICS_PUBLISH_INTERVAL_MS,
          );

          const heartbeatInterval = setInterval(() => {
            if (closed) return;

            controller.enqueue(
              encoder.encode(
                toSseChunk("heartbeat", { timestamp: new Date().toISOString() }),
              ),
            );
          }, serverEnv.SSE_HEARTBEAT_MS);

          const close = () => {
            if (closed) return;
            closed = true;
            clearInterval(statsInterval);
            clearInterval(heartbeatInterval);
            controller.close();

            logServerAction({
              layer: "realtime",
              action: "docker.stats.stream.disconnect",
              status: "success",
              requestId,
              durationMs: Number((performance.now() - connectedAt).toFixed(2)),
            });
          };

          request.signal.addEventListener("abort", close);
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
