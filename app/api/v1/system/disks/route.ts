import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestId, logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { listDisks } from "@/lib/server/modules/system/disk-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      { layer: "api", action: "system.disks.list", requestId },
      async () => {
        const session = await authenticateSession(sessionToken);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const disks = await listDisks();

        logServerAction({
          layer: "api",
          action: "system.disks.list.response",
          status: "success",
          requestId,
          message: `Listed ${disks.length} disk(s)`,
        });

        return NextResponse.json({ data: { disks } });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.disks.list.response",
      status: "error",
      requestId,
      message: "Failed to list disks",
      error,
    });
    return NextResponse.json({ error: "Failed to list disks" }, { status: 500 });
  }
}
