import { NextResponse } from "next/server";
import { createRequestId, withServerTiming } from "@/lib/server/logging/logger";
import { getSystemMetricsSnapshot } from "@/lib/server/modules/system/service";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
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
