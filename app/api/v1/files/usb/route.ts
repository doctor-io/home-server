import { listUsbDrives } from "@/lib/server/modules/files/usb-storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const drives = await listUsbDrives();
  return NextResponse.json({ drives });
}
