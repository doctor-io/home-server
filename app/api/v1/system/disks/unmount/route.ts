import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestId, logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { unmountPartition } from "@/lib/server/modules/system/disk-service";
import type { DiskUnmountRequest } from "@/lib/shared/contracts/disks";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      { layer: "api", action: "system.disks.unmount", requestId },
      async () => {
        const session = await authenticateSession(sessionToken);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = (await request.json()) as DiskUnmountRequest;
        const { device } = body;

        if (!device) {
          return NextResponse.json({ error: "device is required" }, { status: 400 });
        }

        await unmountPartition(device);

        logServerAction({
          layer: "api",
          action: "system.disks.unmount.response",
          status: "success",
          requestId,
          message: `Unmounted ${device}`,
          meta: { userId: session.userId, device },
        });

        return NextResponse.json({ data: { accepted: true, action: "unmount" } });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.disks.unmount.response",
      status: "error",
      requestId,
      message: "Failed to unmount partition",
      error,
    });
    return NextResponse.json({ error: "Failed to unmount partition" }, { status: 500 });
  }
}
