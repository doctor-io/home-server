import { z } from "zod";
import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  getAuthCookieName,
  getSessionCookieOptions,
} from "@/lib/server/modules/auth/cookies";
import { AuthError, loginUser } from "@/lib/server/modules/auth/service";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
        },
        { status: 400 },
      );
    }

    const loginResult = await withServerTiming(
      {
        layer: "api",
        action: "auth.login",
        requestId,
      },
      async () => loginUser(parsed.data),
    );

    const response = NextResponse.json({
      data: {
        id: loginResult.user.id,
        username: loginResult.user.username,
      },
    });

    response.cookies.set(
      getAuthCookieName(),
      loginResult.token,
      getSessionCookieOptions(loginResult.expiresAt),
    );

    return response;
  } catch (error) {
    const statusCode = error instanceof AuthError ? error.statusCode : 500;

    logServerAction({
      level: statusCode >= 500 ? "error" : "warn",
      layer: "api",
      action: "auth.login",
      status: "error",
      requestId,
      error,
    });

    return NextResponse.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "Failed to login",
      },
      { status: statusCode },
    );
  }
}
