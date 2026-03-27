import { createReadStream } from "node:fs";
import path from "node:path";
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
  getMimeTypeForExtension,
  resolveReadableFileAbsolutePath,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";

function toAttachmentFilename(filePath: string) {
  const fileName = path.basename(filePath).replaceAll('"', "");
  return `attachment; filename="${fileName}"`;
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.download.get",
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
            {
              status: 400,
            },
          );
        }

        const includeHidden =
          serverEnv.FILES_ALLOW_HIDDEN &&
          request.nextUrl.searchParams.get("includeHidden") === "true";

        const resolved = await resolveReadableFileAbsolutePath({
          path: filePath,
          includeHidden,
        });
        const ext = path.extname(resolved.path).slice(1).toLowerCase() || null;
        const mimeType = getMimeTypeForExtension(ext) ?? "application/octet-stream";
        const stream = createReadStream(resolved.absolutePath);

        return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
          headers: {
            "Content-Type": mimeType,
            "Content-Disposition": toAttachmentFilename(resolved.path),
            "Cache-Control": "no-store",
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
      action: "files.download.get.response",
      status: "error",
      requestId,
      message: "Unable to download file",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to download file",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}

