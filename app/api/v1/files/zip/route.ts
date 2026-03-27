import { spawn } from "node:child_process";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  FileServiceError,
  resolveDownloadableFolderAbsolutePath,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";
// Zip can take a while for large folders
export const maxDuration = 120;

function toAttachmentFilename(name: string) {
  const safe = name.replaceAll('"', "").replaceAll("/", "_");
  return `attachment; filename="${safe}.zip"`;
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.zip.get",
        requestId,
      },
      async () => {
        const folderPath = request.nextUrl.searchParams.get("path");
        if (!folderPath) {
          return NextResponse.json(
            { error: "Missing folder path", code: "invalid_path" },
            { status: 400 },
          );
        }

        const includeHidden =
          serverEnv.FILES_ALLOW_HIDDEN &&
          request.nextUrl.searchParams.get("includeHidden") === "true";

        const resolved = await resolveDownloadableFolderAbsolutePath({
          path: folderPath,
          includeHidden,
        });

        // Stream the zip output directly using system zip
        // `zip -r - <folderName>` in the parent directory writes to stdout
        const zipStream = new ReadableStream({
          start(controller) {
            const proc = spawn(
              "zip",
              ["-r", "-", resolved.folderName],
              { cwd: resolved.parentAbsolutePath },
            );

            proc.stdout.on("data", (chunk: Buffer) => {
              controller.enqueue(chunk);
            });

            proc.stderr.on("data", (chunk: Buffer) => {
              logServerAction({
                level: "warn",
                layer: "api",
                action: "files.zip.get",
                requestId,
                message: `zip stderr: ${chunk.toString()}`,
              });
            });

            proc.on("close", (code) => {
              if (code === 0) {
                controller.close();
              } else {
                controller.error(new Error(`zip exited with code ${code}`));
              }
            });

            proc.on("error", (err) => {
              controller.error(err);
            });
          },
        });

        const folderBaseName = path.basename(resolved.folderName);

        return new NextResponse(zipStream, {
          status: 200,
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": toAttachmentFilename(folderBaseName),
            "Cache-Control": "no-store",
            "Transfer-Encoding": "chunked",
          },
        });
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
      level: "error",
      layer: "api",
      action: "files.zip.get.response",
      status: "error",
      requestId,
      message: "Unable to zip folder",
      error,
    });

    return NextResponse.json(
      { error: "Unable to zip folder", code: "internal_error" },
      { status: 500 },
    );
  }
}
