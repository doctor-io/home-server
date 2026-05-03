import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { installTailscale } from "@/lib/server/modules/integrations/tailscale-status";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const body = await request.json().catch(() => ({})) as { authKey?: unknown };
    const authKey = typeof body.authKey === "string" ? body.authKey.trim() : "";
    const result = await installTailscale(authKey || undefined);
    return NextResponse.json({ data: result });
  } catch (err) {
    logServerAction({ level: "error", layer: "api", action: "system.tailscale.install", status: "error", requestId, message: "Failed to install Tailscale", error: err });
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to install Tailscale",
        code: "install_failed",
      },
      { status: 500 },
    );
  }
}
