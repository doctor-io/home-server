import { markAllNotificationsRead } from "@/lib/server/modules/notifications/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  await markAllNotificationsRead();
  return NextResponse.json({ ok: true });
}
