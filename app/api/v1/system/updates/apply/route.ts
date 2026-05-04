import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { scheduleSystemUpdate } from "@/lib/server/modules/system/update-service";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

async function authenticateRequest(request: NextRequest, requestId: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);

  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "system.updates.apply.response",
      status: "error",
      requestId,
      message: "Unauthorized Homeio update apply request",
    });
    return null;
  }

  return session;
}

export async function POST(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.updates.apply.post",
        requestId,
      },
      async () => {
        const session = await authenticateRequest(request, requestId);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const accepted = await scheduleSystemUpdate();

        logServerAction({
          layer: "api",
          action: "system.updates.apply.scheduled",
          status: "success",
          requestId,
          message: "Scheduled Homeio update",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        return NextResponse.json({ data: accepted }, { status: 202 });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.updates.apply.response",
      status: "error",
      requestId,
      message: "Failed to schedule Homeio update",
      error,
    });

    return NextResponse.json({ error: "Failed to schedule Homeio update" }, { status: 500 });
  }
}
