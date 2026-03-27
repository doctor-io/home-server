import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  moveToTrash,
  TrashServiceError,
} from "@/lib/server/modules/files/trash-service";

export const runtime = "nodejs";

const moveSchema = z.object({
  path: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.trash.move.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const parsed = moveSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid trash move payload",
              code: "invalid_path",
            },
            {
              status: 400,
            },
          );
        }

        const data = await moveToTrash(parsed.data.path);

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
      action: "files.trash.move.post.response",
      status: "error",
      requestId,
      message: "Unable to move item to Trash",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to move item to Trash",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
