import { toSseChunk } from "@/lib/server/realtime/sse";
import { subscribeToUsbEvents } from "@/lib/server/modules/files/usb-emitter";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const unsubscribe = subscribeToUsbEvents((event) => {
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
