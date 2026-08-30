import { NextResponse } from "next/server";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { getSystemSummary } from "@/lib/server/modules/system/summary-service";

export const runtime = "nodejs";

/**
 * The endpoint an integration polls: host, CPU, memory, storage and every app
 * in one response, so a dashboard costs one request per cycle rather than one
 * per entity.
 */
export async function GET(request: Request) {
  const apiSession = await requireApiSession(request, { scope: "read:metrics" });
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();

  try {
    return NextResponse.json(
      { data: await getSystemSummary() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.summary.get",
      status: "error",
      requestId,
      message: "Failed to build the system summary",
      error,
    });
    return NextResponse.json(
      { error: "Failed to build the system summary", code: "internal_error" },
      { status: 500 },
    );
  }
}
