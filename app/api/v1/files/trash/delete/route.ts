import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  deleteFromTrash,
  TrashServiceError,
} from "@/lib/server/modules/files/trash-service";

export const runtime = "nodejs";

const deleteSchema = z.object({
  path: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.trash.delete.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const parsed = deleteSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid trash delete payload",
              code: "invalid_path",
            },
            {
              status: 400,
            },
          );
        }

        const data = await deleteFromTrash(parsed.data.path);

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
      action: "files.trash.delete.post.response",
      status: "error",
      requestId,
      message: "Unable to permanently delete item from Trash",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to permanently delete item from Trash",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
