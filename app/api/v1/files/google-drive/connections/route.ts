import { NextResponse } from "next/server";
import { listGoogleDriveConnections, GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";

export const runtime = "nodejs";

export async function GET() {
  const requestId = createRequestId();

  try {
    const connections = await listGoogleDriveConnections();
    return NextResponse.json({ data: connections }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "files.google-drive.connections.get",
      status: "error",
      requestId,
      message: "Unable to list Google Drive connections",
      error,
    });

    return NextResponse.json({ error: "Unable to list connections", code: "internal_error" }, { status: 500 });
  }
}
