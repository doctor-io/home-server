import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  LocalSharingError,
  removeLocalFolderShare,
} from "@/lib/server/modules/files/local-sharing";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    shareId: string;
  }>;
};

export async function DELETE(_request: Request, context: Context) {
  const requestId = createRequestId();
  const { shareId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.shared.folders.delete",
        requestId,
        meta: {
          shareId,
        },
      },
      async () => {
        const data = await removeLocalFolderShare(shareId);

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
    if (error instanceof LocalSharingError) {
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
      action: "files.shared.folders.delete.response",
      status: "error",
      requestId,
      message: "Unable to unshare folder",
      error,
      meta: {
        shareId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to unshare folder",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
