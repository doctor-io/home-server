import { type NextRequest, NextResponse } from "next/server";
import { downloadDriveFile } from "@/lib/server/modules/files/google-drive-api";
import { GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

// Google Docs native MIME types cannot be streamed with alt=media — they need export.
const GOOGLE_NATIVE_MIMES = new Set([
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
  "application/vnd.google-apps.drawing",
  "application/vnd.google-apps.form",
]);

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { id } = await context.params;

  const fileId = request.nextUrl.searchParams.get("fileId");
  const filename = request.nextUrl.searchParams.get("name") ?? "download";
  const mimeType = request.nextUrl.searchParams.get("mimeType") ?? "";

  if (!fileId) {
    return NextResponse.json({ error: "Missing fileId", code: "bad_request" }, { status: 400 });
  }

  if (GOOGLE_NATIVE_MIMES.has(mimeType)) {
    return NextResponse.json(
      { error: "Google Docs native formats must be opened in Google Drive", code: "native_format" },
      { status: 422 },
    );
  }

  try {
    const upstream = await downloadDriveFile(id, fileId);

    const headers = new Headers({
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
    });
    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(upstream.body, { headers });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logServerAction({
      level: "error",
      layer: "api",
      action: "files.google-drive.download.get",
      status: "error",
      requestId,
      message: "Failed to download Drive file",
      error,
      meta: { id, fileId },
    });
    return NextResponse.json({ error: "Download failed", code: "internal_error" }, { status: 500 });
  }
}
