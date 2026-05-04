import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  FileServiceError,
  readFileForViewer,
  resolveReadableFileAbsolutePath,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.asset.get",
        requestId,
      },
      async () => {
        const filePath = request.nextUrl.searchParams.get("path");
        if (!filePath) {
          return NextResponse.json(
            {
              error: "Missing file path",
              code: "invalid_path",
            },
            { status: 400 },
          );
        }

        const details = await readFileForViewer({
          path: filePath,
          includeHidden: serverEnv.FILES_ALLOW_HIDDEN,
        });
        if (
          details.mode !== "image" &&
          details.mode !== "pdf" &&
          details.mode !== "video" &&
          details.mode !== "audio"
        ) {
          return NextResponse.json(
            {
              error: "Unsupported asset preview type",
              code: "unsupported_file",
            },
            {
              status: 415,
            },
          );
        }

        const resolved = await resolveReadableFileAbsolutePath({
          path: filePath,
          includeHidden: serverEnv.FILES_ALLOW_HIDDEN,
        });

        // For video/audio files, support HTTP Range requests so the browser
        // can seek without downloading the whole file first.
        if (details.mode === "video" || details.mode === "audio") {
          const rangeHeader = request.headers.get("range");
          const { absolutePath } = resolved;
          const fileSize = details.sizeBytes;

          if (rangeHeader) {
            const [startStr, endStr] = rangeHeader.replace(/bytes=/, "").split("-");
            const start = parseInt(startStr, 10);
            const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const stream = createReadStream(absolutePath, { start, end });
            return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
              status: 206,
              headers: {
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Accept-Ranges": "bytes",
                "Content-Length": String(chunkSize),
                "Content-Type": details.mimeType ?? "application/octet-stream",
                "Cache-Control": "no-store",
              },
            });
          }

          const stream = createReadStream(absolutePath);
          return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
            status: 200,
            headers: {
              "Accept-Ranges": "bytes",
              "Content-Length": String(fileSize),
              "Content-Type": details.mimeType ?? "application/octet-stream",
              "Cache-Control": "no-store",
            },
          });
        }

        const stream = createReadStream(resolved.absolutePath);

        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": details.mimeType ?? "application/octet-stream",
            "Content-Length": String(details.sizeBytes),
            "X-Content-Type-Options": "nosniff",
          },
        });
      },
    );
  } catch (error) {
    if (error instanceof FileServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: error.statusCode,
        },
      );
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "files.asset.get.response",
      status: "error",
      requestId,
      message: "Unable to stream file asset",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to stream file asset",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
