import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { isSystemdAvailable } from "@/lib/server/modules/system/power-service";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.power.capabilities.get",
        requestId,
      },
      async () => {
        const session = await authenticateSession(sessionToken);

        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const systemd = await isSystemdAvailable();

        logServerAction({
          layer: "api",
          action: "system.power.capabilities.get.response",
          status: "success",
          requestId,
          meta: { systemd: String(systemd) },
        });

        return NextResponse.json({
          data: {
            reboot: systemd,
            shutdown: systemd,
            factoryReset: systemd,
            scheduledReboot: systemd,
          },
        });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.power.capabilities.get.response",
      status: "error",
      requestId,
      message: "Failed to check power capabilities",
      error,
    });

    return NextResponse.json({ error: "Failed to check power capabilities" }, { status: 500 });
  }
}
