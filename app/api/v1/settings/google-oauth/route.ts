import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  getGoogleOAuthConfigPublic,
  saveGoogleOAuthConfig,
  clearGoogleOAuthConfig,
} from "@/lib/server/modules/files/google-oauth-config";
import { logServerAction, createRequestId } from "@/lib/server/logging/logger";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  try {
    const config = await getGoogleOAuthConfigPublic();
    return NextResponse.json({ data: config });
  } catch (err) {
    const requestId = createRequestId();
    logServerAction({ level: "error", layer: "api", action: "settings.google-oauth.get", status: "error", requestId, message: "Failed to read Google OAuth config", error: err });
    return NextResponse.json({ error: "Failed to read config", code: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const body = (await request.json()) as { clientId?: string; clientSecret?: string; redirectUri?: string };
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const clientSecret = typeof body.clientSecret === "string" ? body.clientSecret.trim() : "";
    const redirectUri = typeof body.redirectUri === "string" ? body.redirectUri.trim() : "";

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json({ error: "clientId, clientSecret, and redirectUri are required", code: "validation_error" }, { status: 400 });
    }

    await saveGoogleOAuthConfig({ clientId, clientSecret, redirectUri });
    const config = await getGoogleOAuthConfigPublic();
    return NextResponse.json({ data: config });
  } catch (err) {
    logServerAction({ level: "error", layer: "api", action: "settings.google-oauth.put", status: "error", requestId, message: "Failed to save Google OAuth config", error: err });
    return NextResponse.json({ error: "Failed to save config", code: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    await clearGoogleOAuthConfig();
    return NextResponse.json({ data: { clientId: "", redirectUri: "", hasSecret: false } });
  } catch (err) {
    logServerAction({ level: "error", layer: "api", action: "settings.google-oauth.delete", status: "error", requestId, message: "Failed to clear Google OAuth config", error: err });
    return NextResponse.json({ error: "Failed to clear config", code: "internal_error" }, { status: 500 });
  }
}
