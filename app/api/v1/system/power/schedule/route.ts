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
  getScheduledRebootConfig,
  setScheduledRebootConfig,
  type ScheduledRebootConfig,
} from "@/lib/server/modules/system/power-schedule";

export const runtime = "nodejs";

type SchedulePayload = ScheduledRebootConfig;

function isSchedulePayload(value: unknown): value is SchedulePayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<SchedulePayload>;
  const validFrequency = payload.frequency === "daily" || payload.frequency === "weekly";
  const validDay = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ].includes(String(payload.dayOfWeek));
  const validTime = typeof payload.time === "string" && /^\d{2}:\d{2}$/.test(payload.time);

  return typeof payload.enabled === "boolean" && validFrequency && validDay && validTime;
}

async function authenticate(request: NextRequest, requestId: string, action: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);

  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: `${action}.response`,
      status: "error",
      requestId,
      message: "Unauthorized power schedule request",
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
        action: "system.power.schedule.get",
        requestId,
      },
      async () => {
        const session = await authenticate(request, requestId, "system.power.schedule.get");
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const config = await getScheduledRebootConfig();

        return NextResponse.json({ data: config });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.power.schedule.get.response",
      status: "error",
      requestId,
      message: "Failed to load scheduled reboot configuration",
      error,
    });

    return NextResponse.json({ error: "Failed to load scheduled reboot configuration" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "system.power.schedule.put",
        requestId,
      },
      async () => {
        const session = await authenticate(request, requestId, "system.power.schedule.put");
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        if (!isSchedulePayload(body)) {
          return NextResponse.json({ error: "Invalid scheduled reboot payload" }, { status: 400 });
        }

        await setScheduledRebootConfig(body);

        logServerAction({
          layer: "api",
          action: "system.power.schedule.put.saved",
          status: "success",
          requestId,
          message: "Scheduled reboot updated",
          meta: {
            userId: session.userId,
            username: session.username,
            enabled: body.enabled,
            frequency: body.frequency,
            dayOfWeek: body.dayOfWeek,
            time: body.time,
          },
        });

        return NextResponse.json({ data: body });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "system.power.schedule.put.response",
      status: "error",
      requestId,
      message: "Failed to save scheduled reboot configuration",
      error,
    });

    return NextResponse.json({ error: "Failed to save scheduled reboot configuration" }, { status: 500 });
  }
}
