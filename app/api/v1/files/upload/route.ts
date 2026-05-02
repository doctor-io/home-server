import "server-only";

import type { ReadableStream as WebReadableStream } from "stream/web";
import { type NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import busboy from "busboy";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  FileServiceError,
  uploadFiles,
} from "@/lib/server/modules/files/service";
import type { FileUploadResponse } from "@/lib/shared/contracts/files";

export const runtime = "nodejs";

export const maxDuration = 300;

/**
 * Stream-parse a multipart upload and pipe each file directly to disk via
 * uploadFiles, so the full file body is never held in memory at once.
 *
 * Fields (path, includeHidden) MUST appear before file parts in the
 * multipart body — this is the convention and what the client sends.
 */
function streamingUpload(req: NextRequest): Promise<FileUploadResponse> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get("content-type") ?? "";

    let bb: ReturnType<typeof busboy>;
    try {
      bb = busboy({ headers: { "content-type": contentType } });
    } catch (err) {
      reject(new Error(`Invalid multipart request: ${String(err)}`));
      return;
    }

    let destinationPath = "";
    let includeHidden = false;
    const filePromises: Promise<FileUploadResponse>[] = [];

    bb.on("field", (name, value) => {
      if (name === "path") destinationPath = value;
      if (name === "includeHidden") includeHidden = value === "true";
    });

    bb.on("file", (_field, fileStream, info) => {
      // Capture field values at the moment the file part begins.
      // The client sends fields first so these are already populated.
      const dest = destinationPath;
      const hidden = includeHidden;

      // Wrap the live busboy Node.js Readable as a web ReadableStream so it
      // matches the uploadFiles interface. uploadFiles calls stream() and
      // immediately pipes the result — data flows directly to disk without
      // any intermediate in-memory buffer.
      let byteCount = 0;
      fileStream.on("data", (chunk: Buffer) => {
        byteCount += chunk.length;
      });

      const webStream = Readable.toWeb(fileStream) as ReadableStream;

      filePromises.push(
        uploadFiles({
          destinationPath: dest,
          includeHidden: hidden,
          files: [
            {
              name: info.filename,
              get size() {
                return byteCount;
              },
              stream: () => webStream,
            },
          ],
        }),
      );
    });

    bb.on("finish", () => {
      Promise.all(filePromises)
        .then((results) => {
          const merged: FileUploadResponse = { uploaded: [], skipped: [] };
          for (const r of results) {
            merged.uploaded.push(...r.uploaded);
            merged.skipped.push(...r.skipped);
          }
          resolve(merged);
        })
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

export async function POST(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.upload.post",
        requestId,
      },
      async () => {
        const data = await streamingUpload(request);

        if (data.uploaded.length === 0 && data.skipped.length === 0) {
          return NextResponse.json(
            { error: "No files provided" },
            { status: 400 },
          );
        }

        return NextResponse.json({ data });
      },
    );
  } catch (error) {
    if (error instanceof FileServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }

    logServerAction({
      layer: "api",
      action: "files.upload.post",
      requestId,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return NextResponse.json(
      { error: "Failed to upload files" },
      { status: 500 },
    );
  }
}
