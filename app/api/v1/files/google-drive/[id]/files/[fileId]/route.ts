import { type NextRequest, NextResponse } from "next/server";
import { deleteDriveFile } from "@/lib/server/modules/files/google-drive-api";
import { GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; fileId: string }> };

export async function DELETE(request: NextRequest, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { id, fileId } = await context.params;

  try {
    await deleteDriveFile(id, fileId);
    return NextResponse.json({ data: { id: fileId } });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logServerAction({
      level: "error",
      layer: "api",
      action: "files.google-drive.files.delete",
      status: "error",
      requestId,
      message: "Failed to delete Drive file",
      error,
      meta: { id, fileId },
    });
    return NextResponse.json({ error: "Failed to delete file", code: "internal_error" }, { status: 500 });
  }
}
