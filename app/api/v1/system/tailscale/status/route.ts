import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { getLocalTailscaleStatus } from "@/lib/server/modules/integrations/tailscale-status";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const status = await getLocalTailscaleStatus();
    return NextResponse.json({ data: status });
  } catch (err) {
    logServerAction({ level: "error", layer: "api", action: "system.tailscale.status", status: "error", requestId, message: "Failed to read Tailscale status", error: err });
    return NextResponse.json({ error: "Failed to read Tailscale status", code: "internal_error" }, { status: 500 });
  }
}
