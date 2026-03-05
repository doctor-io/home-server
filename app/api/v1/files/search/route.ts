import { type NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  FileServiceError,
  searchFiles,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";
// Recursive search can be slow on large trees
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.search.get",
        requestId,
      },
      async () => {
        const query = request.nextUrl.searchParams.get("q");
        if (!query || query.trim().length === 0) {
          return NextResponse.json(
            { error: "Missing search query", code: "invalid_path" },
            { status: 400 },
          );
        }

        const basePath =
          request.nextUrl.searchParams.get("path") ?? undefined;
        const includeHidden =
          serverEnv.FILES_ALLOW_HIDDEN &&
          request.nextUrl.searchParams.get("includeHidden") === "true";

        const data = await searchFiles({
          query,
          basePath,
          includeHidden,
        });

        return NextResponse.json(
          {
            data,
            meta: { count: data.entries.length },
          },
          {
            headers: { "Cache-Control": "no-store" },
          },
        );
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
      action: "files.search.get",
      requestId,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return NextResponse.json(
      { error: "Search failed", code: "internal_error" },
      { status: 500 },
    );
  }
}
