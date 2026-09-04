import {
  clearAllNotifications,
  listNotifications,
} from "@/lib/server/modules/notifications/service";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const notifications = await listNotifications();

  // The phone resolves a content-free push against this list, so a cached copy
  // does not mean a stale screen — it means an alert that never appears. A CDN
  // in front of a self-hosted server is a normal deployment (Cloudflare Tunnel),
  // and one was observed serving this API with Age: 2916 and a day of max-age.
  return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  await clearAllNotifications();
  return NextResponse.json({ ok: true });
}
