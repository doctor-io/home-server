import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";
import { toSseChunk } from "@/lib/server/realtime/sse";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const requestId = createRequestId();

  return withServerTiming(
    {
      layer: "api",
      action: "system.stream.sse.connect",
      requestId,
    },
    async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          let closed = false;
          const connectedAt = performance.now();

          const pushMetrics = async () => {
            if (closed) return;

            try {
              const snapshot = await getSystemMetricsSnapshot();
              if (closed) return;

              controller.enqueue(
                encoder.encode(
                  toSseChunk("metrics.updated", snapshot, {
                    id: snapshot.timestamp,
                  }),
                ),
              );
            } catch (error) {
              logServerAction({
                level: "error",
                layer: "realtime",
                action: "system.stream.sse.metrics",
                status: "error",
                requestId,
                error,
              });
            }
          };

          void pushMetrics();

          const metricsInterval = setInterval(
            () => {
              void pushMetrics();
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
            clearInterval(metricsInterval);
            clearInterval(heartbeatInterval);
            controller.close();

            logServerAction({
              layer: "realtime",
              action: "system.stream.sse.disconnect",
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
