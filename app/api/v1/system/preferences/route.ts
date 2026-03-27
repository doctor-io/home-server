import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import {
  getSystemPreferences,
  updateSystemPreferences,
} from "@/lib/server/modules/system/preferences-service";
import type { SystemPreferences } from "@/lib/shared/contracts/system";

export const runtime = "nodejs";

function isSystemPreferencesPayload(value: unknown): value is SystemPreferences {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SystemPreferences>;
  return typeof payload.hostname === "string" && typeof payload.timezone === "string";
}

async function authenticateRequest(request: NextRequest, requestId: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);

  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "system.preferences.response",
      status: "error",
      requestId,
      message: "Unauthorized system preferences request",
    });
    return null;
  }

  return session;
}

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.preferences.get",
        requestId,
      },
      async () => {
        const session = await authenticateRequest(request, requestId);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const preferences = await getSystemPreferences();

        logServerAction({
          layer: "api",
          action: "system.preferences.get.read",
          status: "success",
          requestId,
          message: "Loaded system preferences",
          meta: {
            userId: session.userId,
            username: session.username,
            hostname: preferences.hostname,
            timezone: preferences.timezone,
          },
        });

        return NextResponse.json({ data: preferences });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.preferences.get.response",
      status: "error",
      requestId,
      message: "Failed to load system preferences",
      error,
    });

    return NextResponse.json({ error: "Failed to load system preferences" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.preferences.put",
        requestId,
      },
      async () => {
        const session = await authenticateRequest(request, requestId);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        if (!isSystemPreferencesPayload(body)) {
          return NextResponse.json({ error: "Invalid system preferences payload" }, { status: 400 });
        }

        try {
          const preferences = await updateSystemPreferences(body);

          logServerAction({
            layer: "api",
            action: "system.preferences.put.updated",
            status: "success",
            requestId,
            message: "Updated system preferences",
            meta: {
              userId: session.userId,
              username: session.username,
              hostname: preferences.hostname,
              timezone: preferences.timezone,
            },
          });

          return NextResponse.json({ data: preferences });
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
      action: "system.preferences.put.response",
      status: "error",
      requestId,
      message: "Failed to update system preferences",
      error,
    });

    return NextResponse.json({ error: "Failed to update system preferences" }, { status: 500 });
  }
}
