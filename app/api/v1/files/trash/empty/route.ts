import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  emptyTrash,
  TrashServiceError,
} from "@/lib/server/modules/files/trash-service";

export const runtime = "nodejs";

export async function POST() {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.trash.empty.post",
        requestId,
      },
      async () => {
        const data = await emptyTrash();
        return NextResponse.json(
          {
            data,
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
    if (error instanceof TrashServiceError) {
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
      action: "files.trash.empty.post.response",
      status: "error",
      requestId,
      message: "Unable to empty Trash",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to empty Trash",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}

