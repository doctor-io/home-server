import { type NextRequest, NextResponse } from "next/server";
import { listDriveFiles } from "@/lib/server/modules/files/google-drive-api";
import { GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { id } = await context.params;

  const folderId = request.nextUrl.searchParams.get("folderId") ?? "root";
  const pageToken = request.nextUrl.searchParams.get("pageToken") ?? undefined;

  try {
    const data = await listDriveFiles(id, folderId, pageToken);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logServerAction({
      level: "error",
      layer: "api",
      action: "files.google-drive.browse.get",
      status: "error",
      requestId,
      message: "Failed to list Drive files",
      error,
      meta: { id, folderId },
    });
    return NextResponse.json({ error: "Failed to list Drive files", code: "internal_error" }, { status: 500 });
  }
}
