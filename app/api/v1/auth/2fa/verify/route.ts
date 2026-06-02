import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  TotpServiceError,
  completeTotpEnrollment,
} from "@/lib/server/modules/auth/totp-service";

export const runtime = "nodejs";

const verifySchema = z.object({
  code: z.string().trim().min(1).max(16),
});

export async function POST(request: Request) {
  const requestId = createRequestId();
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 },
    );
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 },
    );
  }

  try {
    const data = await withServerTiming(
      {
        layer: "api",
        action: "auth.2fa.verify",
        requestId,
      },
      async () =>
        completeTotpEnrollment({
          userId: apiSession.session.userId,
          code: parsed.data.code,
        }),
    );

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof TotpServiceError) {
      logServerAction({
        level: "warn",
        layer: "api",
        action: "auth.2fa.verify",
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
      action: "auth.2fa.verify",
      status: "error",
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to verify two-factor code" },
      { status: 500 },
    );
  }
}
