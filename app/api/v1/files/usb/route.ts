import { listUsbDrives } from "@/lib/server/modules/files/usb-storage";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const drives = await listUsbDrives();
  return NextResponse.json({ drives });
}
