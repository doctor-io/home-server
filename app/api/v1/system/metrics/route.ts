import { NextResponse } from "next/server";
import { createRequestId, withServerTiming } from "@/lib/server/logging/logger";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";

export const runtime = "nodejs";

export async function GET() {
  const requestId = createRequestId();

  return withServerTiming(
    {
      layer: "api",
      action: "system.metrics.get",
      requestId,
    },
    async () => {
      const snapshot = await getSystemMetricsSnapshot();

      return NextResponse.json(
        {
          data: snapshot,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    },
  );
}
