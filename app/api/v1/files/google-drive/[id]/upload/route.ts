import "server-only";

import type { ReadableStream as WebReadableStream } from "stream/web";
import { type NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import busboy from "busboy";
import { uploadToDrive } from "@/lib/server/modules/files/google-drive-api";
import { GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import type { DriveUploadResponse } from "@/lib/shared/contracts/google-drive";

export const runtime = "nodejs";
export const maxDuration = 300;

function streamingDriveUpload(
  req: NextRequest,
  connectionId: string,
): Promise<DriveUploadResponse> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";

    let bb: ReturnType<typeof busboy>;
    try {
      bb = busboy({ headers: { "content-type": contentType } });
    } catch (err) {
      reject(new Error(`Invalid multipart request: ${String(err)}`));
      return;
    }

    let folderId = "root";
    const filePromises: Promise<{ id: string; name: string }>[] = [];

    bb.on("field", (name, value) => {
      if (name === "folderId") folderId = value;
    });

    bb.on("file", (_field, fileStream, info) => {
      const dest = folderId;
      const mimeType = info.mimeType || "application/octet-stream";
      const webStream = Readable.toWeb(fileStream) as ReadableStream;

      filePromises.push(
        uploadToDrive(connectionId, dest, info.filename, mimeType, webStream),
      );
    });

    bb.on("finish", () => {
      Promise.all(filePromises)
        .then((results) => resolve({ uploaded: results }))
        .catch(reject);
    });

    bb.on("error", reject);

    if (!req.body) {
      reject(new Error("No request body"));
      return;
    }
    Readable.fromWeb(req.body as WebReadableStream).pipe(bb);
  });
}

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { id } = await context.params;

  try {
    const data = await streamingDriveUpload(request, id);

    if (data.uploaded.length === 0) {
      return NextResponse.json({ error: "No files provided", code: "no_files" }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logServerAction({
      level: "error",
      layer: "api",
      action: "files.google-drive.upload.post",
      status: "error",
      requestId,
      message: "Drive upload failed",
      error,
      meta: { id },
    });
    return NextResponse.json({ error: "Upload failed", code: "internal_error" }, { status: 500 });
  }
}
