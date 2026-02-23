import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  getNetworkStatusFromHelper,
  isNetworkHelperUnavailableError,
  NetworkHelperError,
} from "@/lib/server/modules/network/helper-client";
import {
  getLatestNetworkEvent,
  subscribeToNetworkEvents,
} from "@/lib/server/modules/network/events";
import { toSseChunk } from "@/lib/server/realtime/sse";
import type { NetworkEvent } from "@/lib/shared/contracts/network";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = createRequestId();

  try {
    await getNetworkStatusFromHelper({
      requestId,
      timeoutMs: 2_000,
    });
  } catch (error) {
    if (isNetworkHelperUnavailableError(error)) {
      return NextResponse.json(
        {
          error: "DBus helper unavailable",
          code: "helper_unavailable",
        },
        { status: 503 },
      );
    }

    if (error instanceof NetworkHelperError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: error.statusCode,
        },
      );
    }

    return NextResponse.json(
      {
        error: "Unable to open network event stream",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "network.events.stream.get",
        requestId,
      },
      async () => {
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let closed = false;
            let unsubscribe: (() => void) | null = null;

            const close = () => {
              if (closed) return;
              closed = true;
              if (unsubscribe) unsubscribe();
              controller.close();
            };

            const sendHeartbeat = () => {
              if (closed) return;
              controller.enqueue(
                encoder.encode(
                  toSseChunk("heartbeat", {
                    timestamp: new Date().toISOString(),
                  }),
                ),
              );
            };

            const sendEvent = (event: NetworkEvent) => {
              if (closed) return;
              controller.enqueue(
                encoder.encode(toSseChunk(event.type, event, { id: event.timestamp })),
              );
            };

            const latest = getLatestNetworkEvent();
            if (latest) {
              sendEvent(latest);
            }

            unsubscribe = subscribeToNetworkEvents(sendEvent);

            const heartbeat = setInterval(sendHeartbeat, serverEnv.SSE_HEARTBEAT_MS);
            const teardown = () => {
              clearInterval(heartbeat);
              close();
            };

            request.signal.addEventListener("abort", teardown);
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
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "network.events.stream.get.response",
      status: "error",
      requestId,
      message: "Unable to stream network events",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to stream network events",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
