import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { resolveDashboardUrlForApp } from "@/lib/server/modules/apps/service";

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
        action: "apps.dashboardUrl.get",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const data = await resolveDashboardUrlForApp(appId);
        return NextResponse.json(data, {
          headers: {
            "Cache-Control": "no-store",
          },
        });
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve dashboard URL";
    const notFound = message.toLowerCase().includes("not installed");

    logServerAction({
      level: notFound ? "warn" : "error",
      layer: "api",
      action: "apps.dashboardUrl.get.response",
      status: "error",
      requestId,
      message,
      error,
      meta: {
        appId,
      },
    });

    return NextResponse.json(
      {
        error: message,
        code: notFound ? "not_found" : "internal_error",
      },
      {
        status: notFound ? 404 : 500,
      },
    );
  }
}
