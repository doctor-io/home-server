import { toSseChunk } from "@/lib/server/realtime/sse";
import { subscribeToNotifications } from "@/lib/server/modules/notifications/emitter";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const unsubscribe = subscribeToNotifications((event) => {
        if (closed) return;
        controller.enqueue(encoder.encode(toSseChunk(event.type, event)));
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(toSseChunk("heartbeat", { timestamp: new Date().toISOString() })),
        );
      }, 30_000);

      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        controller.close();
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
}
