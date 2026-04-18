import { unmountUsbDrive } from "@/lib/server/modules/files/usb-storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ driveId: string }> }) {
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
