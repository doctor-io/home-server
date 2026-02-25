import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { toSseChunk } from "@/lib/server/realtime/sse";
import {
  getLatestStoreOperationEvent,
  getStoreOperation,
  subscribeToStoreOperation,
} from "@/lib/server/modules/apps/operations";
import type { StoreOperationEvent } from "@/lib/shared/contracts/apps";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    operationId: string;
  }>;
};

function operationSnapshotToEvent(operation: NonNullable<Awaited<ReturnType<typeof getStoreOperation>>>) {
  const type: StoreOperationEvent["type"] =
    operation.status === "success"
      ? "operation.completed"
      : operation.status === "error"
        ? "operation.failed"
        : "operation.step";

  return {
    type,
    operationId: operation.id,
    appId: operation.appId,
    action: operation.action,
    status: operation.status,
    progressPercent: operation.progressPercent,
    step: operation.currentStep,
    message: operation.errorMessage ?? undefined,
    timestamp: operation.updatedAt,
  } satisfies StoreOperationEvent;
}

export async function GET(request: Request, context: Context) {
  const requestId = createRequestId();
  const { operationId } = await context.params;

  try {
    const operation = await getStoreOperation(operationId);
    if (!operation) {
      return NextResponse.json(
        {
          error: "Operation not found",
        },
        { status: 404 },
      );
    }

    const encoder = new TextEncoder();

    return await withServerTiming(
      {
        layer: "api",
        action: "store.operations.stream.get",
        requestId,
        meta: {
          operationId,
        },
      },
      async () => {
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

            const send = (event: StoreOperationEvent) => {
              if (closed) return;

              controller.enqueue(
                encoder.encode(toSseChunk(event.type, event, { id: event.timestamp })),
              );

              if (event.status === "success" || event.status === "error") {
                close();
              }
            };

            const latest = getLatestStoreOperationEvent(operationId);
            if (latest) {
              send(latest);
            } else {
              send(operationSnapshotToEvent(operation));
            }

            unsubscribe = subscribeToStoreOperation(operationId, send);

            const heartbeat = setInterval(() => {
              if (closed) return;
              controller.enqueue(
                encoder.encode(
                  toSseChunk("heartbeat", {
                    timestamp: new Date().toISOString(),
                    operationId,
                  }),
                ),
              );
            }, serverEnv.SSE_HEARTBEAT_MS);

            const finalClose = () => {
              clearInterval(heartbeat);
              close();
            };

            request.signal.addEventListener("abort", finalClose);
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
      action: "store.operations.stream.get.response",
      status: "error",
      requestId,
      message: "Unable to stream operation progress",
      error,
      meta: {
        operationId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to stream operation progress",
      },
      { status: 500 },
    );
  }
}
