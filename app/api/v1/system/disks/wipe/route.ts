import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestId, logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { wipeDisk } from "@/lib/server/modules/system/disk-service";
import type { DiskWipeRequest } from "@/lib/shared/contracts/disks";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      { layer: "api", action: "system.disks.wipe", requestId },
      async () => {
        const session = await authenticateSession(sessionToken);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json()) as DiskWipeRequest;
        const { disk } = body;

        if (!disk) {
          return NextResponse.json({ error: "disk is required" }, { status: 400 });
        }

        await wipeDisk(disk);

        logServerAction({
          layer: "api",
          action: "system.disks.wipe.response",
          status: "success",
          requestId,
          message: `Wiped disk ${disk}`,
          meta: { userId: session.userId, disk },
        });

        return NextResponse.json({ data: { accepted: true, action: "wipe" } });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.disks.wipe.response",
      status: "error",
      requestId,
      message: "Failed to wipe disk",
      error,
    });
    return NextResponse.json({ error: "Failed to wipe disk" }, { status: 500 });
  }
}
