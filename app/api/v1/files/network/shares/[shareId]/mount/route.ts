import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  mountShare,
  NetworkStorageError,
  startNetworkStorageWatcher,
} from "@/lib/server/modules/files/network-storage";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    shareId: string;
  }>;
};

startNetworkStorageWatcher();

export async function POST(_request: Request, context: Context) {
  const requestId = createRequestId();
  const { shareId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.network.mount.post",
        requestId,
        meta: {
          shareId,
        },
      },
      async () => {
        const data = await mountShare(shareId);

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
    if (error instanceof NetworkStorageError) {
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
      action: "files.network.mount.post.response",
      status: "error",
      requestId,
      message: "Unable to mount network share",
      error,
      meta: {
        shareId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to mount network share",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
