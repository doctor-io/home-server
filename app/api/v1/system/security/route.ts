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
  getSystemSecuritySettings,
  updateSystemSecuritySettings,
} from "@/lib/server/modules/system/security-service";
import type { SystemSecuritySettings } from "@/lib/shared/contracts/system";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

function isSystemSecurityPayload(value: unknown): value is SystemSecuritySettings {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<SystemSecuritySettings>;
  return (
    typeof payload.firewallEnabled === "boolean" &&
    typeof payload.firewallIncomingPolicy === "string" &&
    typeof payload.firewallOutgoingPolicy === "string" &&
    typeof payload.fail2banEnabled === "boolean" &&
    typeof payload.fail2banMaxRetries === "number" &&
    typeof payload.fail2banBanDurationSeconds === "number"
  );
}

async function authenticateRequest(request: NextRequest, requestId: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);

  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "system.security.response",
      status: "error",
      requestId,
      message: "Unauthorized system security request",
    });
    return null;
  }

  return session;
}

function isValidationError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("invalid");
}

export async function GET(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.security.get",
        requestId,
      },
      async () => {
        const session = await authenticateRequest(request, requestId);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const settings = await getSystemSecuritySettings();

        logServerAction({
          layer: "api",
          action: "system.security.get.read",
          status: "success",
          requestId,
          message: "Loaded system security settings",
          meta: {
            userId: session.userId,
            username: session.username,
            firewallEnabled: settings.firewallEnabled,
            firewallIncomingPolicy: settings.firewallIncomingPolicy,
            firewallOutgoingPolicy: settings.firewallOutgoingPolicy,
            fail2banEnabled: settings.fail2banEnabled,
            fail2banMaxRetries: settings.fail2banMaxRetries,
            fail2banBanDurationSeconds: settings.fail2banBanDurationSeconds,
          },
        });

        return NextResponse.json({ data: settings });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.security.get.response",
      status: "error",
      requestId,
      message: "Failed to load system security settings",
      error,
    });

    return NextResponse.json({ error: "Failed to load security settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.security.put",
        requestId,
      },
      async () => {
        const session = await authenticateRequest(request, requestId);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        if (!isSystemSecurityPayload(body)) {
          return NextResponse.json({ error: "Invalid system security payload" }, { status: 400 });
        }

        try {
          const settings = await updateSystemSecuritySettings(body);

          logServerAction({
            layer: "api",
            action: "system.security.put.updated",
            status: "success",
            requestId,
            message: "Updated system security settings",
            meta: {
              userId: session.userId,
              username: session.username,
              firewallEnabled: settings.firewallEnabled,
              firewallIncomingPolicy: settings.firewallIncomingPolicy,
              firewallOutgoingPolicy: settings.firewallOutgoingPolicy,
              fail2banEnabled: settings.fail2banEnabled,
              fail2banMaxRetries: settings.fail2banMaxRetries,
              fail2banBanDurationSeconds: settings.fail2banBanDurationSeconds,
            },
          });

          return NextResponse.json({ data: settings });
        } catch (error) {
          if (isValidationError(error)) {
            return NextResponse.json({ error: (error as Error).message }, { status: 400 });
          }
          throw error;
        }
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.security.put.response",
      status: "error",
      requestId,
      message: "Failed to update system security settings",
      error,
    });

    return NextResponse.json({ error: "Failed to update security settings" }, { status: 500 });
  }
}
