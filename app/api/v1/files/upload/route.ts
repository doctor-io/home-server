import { type NextRequest, NextResponse } from "next/server";
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

export const runtime = "nodejs";

export const maxDuration = 300;

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
        const formData = await request.formData();
        const destinationPath = (formData.get("path") as string | null) ?? "";
        const includeHidden = formData.get("includeHidden") === "true";

        const fileEntries = formData.getAll("file");
        if (fileEntries.length === 0) {
          return NextResponse.json(
            { error: "No files provided" },
            { status: 400 },
          );
        }

        const files: { name: string; size: number; stream: () => ReadableStream }[] = [];
        for (const entry of fileEntries) {
          if (!(entry instanceof File)) continue;
          files.push({
            name: entry.name,
            size: entry.size,
            stream: () => entry.stream(),
          });
        }

        if (files.length === 0) {
          return NextResponse.json(
            { error: "No valid files in request" },
            { status: 400 },
          );
        }

        const data = await uploadFiles({
          destinationPath,
          files,
          includeHidden,
        });

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
