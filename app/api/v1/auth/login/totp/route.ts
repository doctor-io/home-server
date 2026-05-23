import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  getAuthCookieName,
  getSessionCookieOptions,
} from "@/lib/server/modules/auth/cookies";
import {
  TotpServiceError,
  completeTotpLogin,
} from "@/lib/server/modules/auth/totp-service";

export const runtime = "nodejs";

// This route is intentionally unauthenticated — the caller has not yet
// completed login. The architecture test in
// app/api/v1/__tests__/auth-architecture.test.ts allowlists this path.
// Do NOT call requireApiSession() here.

const loginTotpSchema = z.object({
  partialAuthToken: z.string().min(1).max(512),
  code: z.string().trim().min(1).max(32),
});

export async function POST(request: Request) {
  const requestId = createRequestId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 },
    );
  }

  const parsed = loginTotpSchema.safeParse(body);
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
        action: "auth.login.totp",
        requestId,
      },
      async () => completeTotpLogin(parsed.data),
    );

    const response = NextResponse.json({
      data: {
        id: data.user.id,
        username: data.user.username,
      },
    });

    response.cookies.set(
      getAuthCookieName(),
      data.sessionToken,
      getSessionCookieOptions(data.sessionExpiresAt, request),
    );

    return response;
  } catch (error) {
    if (error instanceof TotpServiceError) {
      logServerAction({
        level: "warn",
        layer: "api",
        action: "auth.login.totp",
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
      action: "auth.login.totp",
      status: "error",
      requestId,
      error,
    });
    return NextResponse.json(
      { error: "Failed to complete two-factor login" },
      { status: 500 },
    );
  }
}
