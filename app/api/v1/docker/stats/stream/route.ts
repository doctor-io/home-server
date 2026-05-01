import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAllContainersStats } from "@/lib/server/modules/docker/stats";
import { toSseChunk } from "@/lib/server/realtime/sse";
import type { DockerStatsPayload } from "@/lib/shared/contracts/docker";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

/** Soft cap on concurrent SSE clients for the Docker stats stream. */
const MAX_DOCKER_STATS_CONNECTIONS = 10;
let activeDockerStatsConnections = 0;

/**
 * GET /api/v1/docker/stats/stream
 *
 * Server-Sent Events stream for real-time Docker container stats.
 * Returns 429 when more than MAX_DOCKER_STATS_CONNECTIONS clients are connected.
 */
export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  if (activeDockerStatsConnections >= MAX_DOCKER_STATS_CONNECTIONS) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "docker.stats.stream.rate-limit",
      status: "error",
      message: `Docker stats SSE connection rejected — limit of ${MAX_DOCKER_STATS_CONNECTIONS} reached`,
    });
    return new Response(
      JSON.stringify({ error: "Too many SSE connections", code: "rate_limited" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const encoder = new TextEncoder();
  const requestId = createRequestId();
  activeDockerStatsConnections++;

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
              const result = await getAllContainersStats();
              if (closed) return;

              const payload: DockerStatsPayload = result;

              controller.enqueue(
                encoder.encode(
                  toSseChunk("stats.updated", payload, {
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

          // Update stats at the configured interval
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
            activeDockerStatsConnections--;
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
