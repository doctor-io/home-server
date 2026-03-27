import { NextResponse } from "next/server";
import { createRequestId, withServerTiming } from "@/lib/server/logging/logger";

export const runtime = "nodejs";

export async function GET() {
  const requestId = createRequestId();

  return withServerTiming(
    {
      layer: "api",
      action: "health.get",
      requestId,
    },
    async () =>
      NextResponse.json({
        ok: true,
        service: "home-server",
        timestamp: new Date().toISOString(),
      }),
  );
}
