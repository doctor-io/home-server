import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import {
  clearTailscaleConfig,
  getTailscaleConfigPublic,
  saveTailscaleConfig,
} from "@/lib/server/modules/integrations/tailscale-config";
import type { TailscaleConfigSaveRequest } from "@/lib/shared/contracts/tailscale";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const config = await getTailscaleConfigPublic();
    return NextResponse.json({ data: config });
  } catch (err) {
    logServerAction({ level: "error", layer: "api", action: "settings.tailscale.get", status: "error", requestId, message: "Failed to read Tailscale config", error: err });
    return NextResponse.json({ error: "Failed to read config", code: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const body = (await request.json()) as Partial<TailscaleConfigSaveRequest>;
    const tailnet = typeof body.tailnet === "string" ? body.tailnet.trim() : "";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!tailnet || !apiKey) {
      return NextResponse.json({ error: "tailnet and apiKey are required", code: "validation_error" }, { status: 400 });
    }

    await saveTailscaleConfig({ tailnet, apiKey });
    const config = await getTailscaleConfigPublic();
    return NextResponse.json({ data: config });
  } catch (err) {
    logServerAction({ level: "error", layer: "api", action: "settings.tailscale.put", status: "error", requestId, message: "Failed to save Tailscale config", error: err });
    return NextResponse.json({ error: "Failed to save config", code: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    await clearTailscaleConfig();
    return NextResponse.json({ data: { tailnet: "", hasApiKey: false } });
  } catch (err) {
    logServerAction({ level: "error", layer: "api", action: "settings.tailscale.delete", status: "error", requestId, message: "Failed to clear Tailscale config", error: err });
    return NextResponse.json({ error: "Failed to clear config", code: "internal_error" }, { status: 500 });
  }
}
