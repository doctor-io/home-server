import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getStoreAppDetail } from "@/lib/server/modules/store/service";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    appId: string;
  }>;
};

export async function GET(_request: Request, context: Context) {
  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.apps.detail.get",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const detail = await getStoreAppDetail(appId);
        if (!detail) {
          return NextResponse.json(
            {
              error: "App not found",
            },
            { status: 404 },
          );
        }

        return NextResponse.json(
          {
            data: detail,
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
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.apps.detail.get.response",
      status: "error",
      requestId,
      message: "Unable to load store app detail",
      error,
      meta: {
        appId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to load store app detail",
      },
      { status: 500 },
    );
  }
}
