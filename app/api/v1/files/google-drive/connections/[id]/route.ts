import { NextResponse } from "next/server";
import { removeGoogleDriveConnection, GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { id } = await context.params;

  try {
    await removeGoogleDriveConnection(id);
    return NextResponse.json({ data: { id } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "files.google-drive.connections.delete",
      status: "error",
      requestId,
      message: "Unable to remove Google Drive connection",
      error,
      meta: { id },
    });

    return NextResponse.json({ error: "Unable to remove connection", code: "internal_error" }, { status: 500 });
  }
}
