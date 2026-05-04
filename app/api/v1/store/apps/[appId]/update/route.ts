import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { StoreOperationError } from "@/lib/server/modules/apps/operations";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    appId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.apps.update.post",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const result = await startAppLifecycleAction({
          appId,
          action: "update",
        });

        return NextResponse.json(result, { status: 202 });
      },
    );
  } catch (error) {
    if (error instanceof StoreOperationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "store.apps.update.post.response",
      status: "error",
      requestId,
      message: "Unable to start update operation",
      error,
      meta: {
        appId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to start update operation",
      },
      { status: 500 },
    );
  }
}
