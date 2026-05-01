import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  FileServiceError,
  getStarredEntries,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        level: "debug",
        layer: "api",
        action: "files.starred.get",
        requestId,
      },
      async () => {
        const data = await getStarredEntries();

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
      layer: "api",
      action: "files.starred.get",
      requestId,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return NextResponse.json(
      { error: "Failed to fetch starred items" },
      { status: 500 },
    );
  }
}
