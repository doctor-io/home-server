import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { getSystemUpdateStatus } from "@/lib/server/modules/system/update-service";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

async function authenticateRequest(request: NextRequest, requestId: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);

  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "system.updates.response",
      status: "error",
      requestId,
      message: "Unauthorized system updates request",
    });
    return null;
  }

  return session;
}

export async function GET(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.updates.get",
        requestId,
      },
      async () => {
        const session = await authenticateRequest(request, requestId);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const status = await getSystemUpdateStatus();

        logServerAction({
          layer: "api",
          action: "system.updates.get.read",
          status: "success",
          requestId,
          message: "Loaded Homeio update status",
          meta: {
            userId: session.userId,
            username: session.username,
            currentVersion: status.currentVersion,
            latestVersion: status.latestVersion,
            updateAvailable: status.updateAvailable,
          },
        });

        return NextResponse.json({ data: status });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.updates.get.response",
      status: "error",
      requestId,
      message: "Failed to load Homeio update status",
      error,
    });

    return NextResponse.json({ error: "Failed to load Homeio updates" }, { status: 500 });
  }
}
