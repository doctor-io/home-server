import { mountUsbDrive } from "@/lib/server/modules/files/usb-storage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ driveId: string }> }) {
  const { driveId } = await params;
  try {
    const drive = await mountUsbDrive(driveId);
    return NextResponse.json({ drive });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mount failed" },
      { status: 500 },
    );
  }
}
