import { markAllNotificationsRead } from "@/lib/server/modules/notifications/service";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  await markAllNotificationsRead();
  return NextResponse.json({ ok: true });
}
