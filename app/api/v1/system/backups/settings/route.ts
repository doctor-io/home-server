import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { updateSystemBackupSettings } from "@/lib/server/modules/system/backup-service";
import type { SystemBackupSettings } from "@/lib/shared/contracts/system";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

function isBackupSettingsPayload(value: unknown): value is SystemBackupSettings {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SystemBackupSettings>;
  return (
    typeof payload.enabled === "boolean" &&
    typeof payload.frequency === "string" &&
    typeof payload.dayOfWeek === "string" &&
    typeof payload.time === "string" &&
    typeof payload.retentionCount === "number"
  );
}

export async function PUT(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.backups.settings.put",
        requestId,
      },
      async () => {
        const session = await authenticateSession(sessionToken);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        if (!isBackupSettingsPayload(body)) {
          return NextResponse.json({ error: "Invalid backup settings payload" }, { status: 400 });
        }

        try {
          const settings = await updateSystemBackupSettings(body);

          logServerAction({
            layer: "api",
            action: "system.backups.settings.put.updated",
            status: "success",
            requestId,
            message: "Updated backup schedule settings",
            meta: {
              userId: session.userId,
              username: session.username,
              enabled: settings.enabled,
              frequency: settings.frequency,
              dayOfWeek: settings.dayOfWeek,
              time: settings.time,
              retentionCount: settings.retentionCount,
            },
          });

          return NextResponse.json({ data: settings });
        } catch (error) {
          if (error instanceof Error && error.message.toLowerCase().includes("invalid")) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          throw error;
        }
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.backups.settings.put.response",
      status: "error",
      requestId,
      message: "Failed to update backup settings",
      error,
    });

    return NextResponse.json({ error: "Failed to update backup settings" }, { status: 500 });
  }
}
