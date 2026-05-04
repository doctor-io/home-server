import { NextResponse } from "next/server";
import { listGoogleDriveConnections, isGoogleDriveConfigured, GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    const configured = await isGoogleDriveConfigured();
    const connections = configured ? await listGoogleDriveConnections() : [];
    return NextResponse.json({ data: connections, configured }, { headers: { "Cache-Control": "no-store" } });
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
