import { NextResponse } from "next/server";

import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  TotpServiceError,
  beginTotpEnrollment,
} from "@/lib/server/modules/auth/totp-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  try {
    const data = await withServerTiming(
      {
        layer: "api",
        action: "auth.2fa.setup",
        requestId,
      },
      async () => beginTotpEnrollment(apiSession.session.userId),
    );

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof TotpServiceError) {
      logServerAction({
        level: "warn",
        layer: "api",
        action: "auth.2fa.setup",
        status: "error",
        requestId,
        error,
        meta: { code: error.code },
      });
      return NextResponse.json(
        { error: error.publicMessage, code: error.code },
        { status: error.statusCode },
      );
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.2fa.setup",
      status: "error",
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to start two-factor setup" },
      { status: 500 },
    );
  }
}
