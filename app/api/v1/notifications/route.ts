import {
  clearAllNotifications,
  listNotifications,
} from "@/lib/server/modules/notifications/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}

export async function DELETE() {
  await clearAllNotifications();
  return NextResponse.json({ ok: true });
}
