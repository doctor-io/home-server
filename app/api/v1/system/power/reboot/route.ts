import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { scheduleSystemReboot } from "@/lib/server/modules/system/power-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.power.reboot.post",
        requestId,
      },
      async () => {
        const session = await authenticateSession(sessionToken);

        if (!session) {
          logServerAction({
            level: "warn",
            layer: "api",
            action: "system.power.reboot.post.response",
            status: "error",
            requestId,
            message: "Unauthorized reboot request",
          });

          return NextResponse.json(
            {
              error: "Unauthorized",
            },
            { status: 401 },
          );
        }

        logServerAction({
          layer: "api",
          action: "system.power.reboot.post.accepted",
          status: "info",
          requestId,
          message: "Authenticated reboot request accepted",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        await scheduleSystemReboot();

        logServerAction({
          layer: "api",
          action: "system.power.reboot.post.scheduled",
          status: "success",
          requestId,
          message: "System reboot command scheduled",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        return NextResponse.json(
          {
            data: {
              action: "reboot",
              accepted: true,
            },
          },
          { status: 202 },
        );
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.power.reboot.post.response",
      status: "error",
      requestId,
      message: "Failed to schedule system reboot",
      error,
    });

    return NextResponse.json(
      {
        error: "Failed to schedule reboot",
      },
      { status: 500 },
    );
  }
}
