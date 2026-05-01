import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { listInstalledApps } from "@/lib/server/modules/apps/service";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "apps.list.get",
        requestId,
      },
      async () => {
        const apps = await listInstalledApps();

        return NextResponse.json({
          data: apps,
          meta: {
            count: apps.length,
          },
        });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "apps.list.get.response",
      status: "error",
      requestId,
      message: "Unable to load apps",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to load apps",
      },
      { status: 500 },
    );
  }
}
