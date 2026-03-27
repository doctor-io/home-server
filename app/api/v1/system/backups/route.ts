import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { getSystemBackupsSnapshot } from "@/lib/server/modules/system/backup-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.backups.get",
        requestId,
      },
      async () => {
        const session = await authenticateSession(sessionToken);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const snapshot = await getSystemBackupsSnapshot();

        logServerAction({
          layer: "api",
          action: "system.backups.get.read",
          status: "success",
          requestId,
          message: "Loaded system backups snapshot",
          meta: {
            userId: session.userId,
            username: session.username,
            backupCount: snapshot.backups.length,
            backupRoot: snapshot.backupRoot,
            automaticBackupsEnabled: snapshot.settings.enabled,
          },
        });

        return NextResponse.json({ data: snapshot });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.backups.get.response",
      status: "error",
      requestId,
      message: "Failed to load system backups snapshot",
      error,
    });

    return NextResponse.json({ error: "Failed to load backups" }, { status: 500 });
  }
}
