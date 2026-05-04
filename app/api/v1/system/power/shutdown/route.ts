import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { scheduleSystemShutdown } from "@/lib/server/modules/system/power-service";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.power.shutdown.post",
        requestId,
      },
      async () => {
        const session = await authenticateSession(sessionToken);

        if (!session) {
          logServerAction({
            level: "warn",
            layer: "api",
            action: "system.power.shutdown.post.response",
            status: "error",
            requestId,
            message: "Unauthorized shutdown request",
          });

          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        logServerAction({
          layer: "api",
          action: "system.power.shutdown.post.accepted",
          status: "info",
          requestId,
          message: "Authenticated shutdown request accepted",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        await scheduleSystemShutdown();

        logServerAction({
          layer: "api",
          action: "system.power.shutdown.post.scheduled",
          status: "success",
          requestId,
          message: "System shutdown command scheduled",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        return NextResponse.json({ data: { action: "shutdown", accepted: true } }, { status: 202 });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.power.shutdown.post.response",
      status: "error",
      requestId,
      message: "Failed to schedule system shutdown",
      error,
    });

    return NextResponse.json({ error: "Failed to schedule shutdown" }, { status: 500 });
  }
}
