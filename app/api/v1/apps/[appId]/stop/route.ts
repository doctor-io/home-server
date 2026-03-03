import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    appId: string;
  }>;
};

export async function POST(_request: Request, context: Context) {
  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "apps.stop.post",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const result = await startAppLifecycleAction({
          appId,
          action: "stop",
        });

        return NextResponse.json(
          {
            operationId: result.operationId,
            status: "queued",
            appId,
          },
          { status: 202 },
        );
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "apps.stop.post.response",
      status: "error",
      requestId,
      message: "Unable to stop app",
      error,
      meta: {
        appId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to stop app",
        code: "internal_error",
      },
      { status: 500 },
    );
  }
}

