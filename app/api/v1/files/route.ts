import { type NextRequest, NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  FileServiceError,
  listDirectory,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.list.get",
        requestId,
      },
      async () => {
        const searchParams = request.nextUrl.searchParams;
        const filePath = searchParams.get("path") ?? undefined;
        const includeHidden = searchParams.get("includeHidden") === "true";
        const data = await listDirectory({
          path: filePath,
          includeHidden,
        });

        return NextResponse.json(
          {
            data,
            meta: {
              count: data.entries.length,
            },
          },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
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
      action: "files.list.get.response",
      status: "error",
      requestId,
      message: "Unable to list files",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to list files",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
