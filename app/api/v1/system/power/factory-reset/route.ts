import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { deleteScheduledRebootArtifacts } from "@/lib/server/modules/system/power-schedule";
import {
  deleteFactoryResetArtifacts,
  scheduleFactoryReset,
} from "@/lib/server/modules/system/power-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.power.factory-reset.post",
        requestId,
      },
      async () => {
        const session = await authenticateSession(sessionToken);

        if (!session) {
          logServerAction({
            level: "warn",
            layer: "api",
            action: "system.power.factory-reset.post.response",
            status: "error",
            requestId,
            message: "Unauthorized factory reset request",
          });

          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        logServerAction({
          layer: "api",
          action: "system.power.factory-reset.post.accepted",
          status: "warn",
          requestId,
          message: "Authenticated factory reset request accepted",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        await deleteScheduledRebootArtifacts();
        await deleteFactoryResetArtifacts();
        await scheduleFactoryReset();

        logServerAction({
          layer: "api",
          action: "system.power.factory-reset.post.scheduled",
          status: "success",
          requestId,
          message: "Factory reset workflow scheduled",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        return NextResponse.json({ data: { action: "factory-reset", accepted: true } }, { status: 202 });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.power.factory-reset.post.response",
      status: "error",
      requestId,
      message: "Failed to schedule factory reset",
      error,
    });

    return NextResponse.json({ error: "Failed to schedule factory reset" }, { status: 500 });
  }
}
