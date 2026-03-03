import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { type NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
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
        if (!(details.mode === "image" || details.mode === "pdf")) {
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
