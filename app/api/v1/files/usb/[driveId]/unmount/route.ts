import { unmountUsbDrive } from "@/lib/server/modules/files/usb-storage";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ driveId: string }> }) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const { driveId } = await params;
  try {
    await unmountUsbDrive(driveId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unmount failed" },
      { status: 500 },
    );
  }
}
