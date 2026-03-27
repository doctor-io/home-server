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
