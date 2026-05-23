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
  disableTotp,
} from "@/lib/server/modules/auth/totp-service";

export const runtime = "nodejs";

// 6-digit TOTP and 10-char backup codes both fit; allow generous whitespace
// and dashes so users can paste freely.
const disableSchema = z.object({
  code: z.string().trim().min(1).max(32),
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

  const parsed = disableSchema.safeParse(body);
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
        action: "auth.2fa.disable",
        requestId,
      },
      async () =>
        disableTotp({
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
        action: "auth.2fa.disable",
        status: "error",
        requestId,
        error,
        meta: { code: error.code },
      });
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.2fa.disable",
      status: "error",
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to disable two-factor authentication" },
      { status: 500 },
    );
  }
}
