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
  return NextResponse.json({ notifications });
}

export async function DELETE(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  await clearAllNotifications();
  return NextResponse.json({ ok: true });
}
