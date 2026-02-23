import { z } from "zod";
import { NextResponse } from "next/server";
import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { hasAnyUsers } from "@/lib/server/modules/auth/repository";
import { AuthError, registerUser } from "@/lib/server/modules/auth/service";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const usersExist = await hasAnyUsers();
    if (!serverEnv.AUTH_ALLOW_REGISTRATION && usersExist) {
      return NextResponse.json(
        {
          error: "Registration is disabled",
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
        },
        { status: 400 },
      );
    }

    const user = await withServerTiming(
      {
        layer: "api",
        action: "auth.register",
        requestId,
      },
      async () => registerUser(parsed.data),
    );

    return NextResponse.json(
      {
        data: {
          id: user.id,
          username: user.username,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const statusCode = error instanceof AuthError ? error.statusCode : 500;

    logServerAction({
      level: statusCode >= 500 ? "error" : "warn",
      layer: "api",
      action: "auth.register",
      status: "error",
      requestId,
      error,
    });

    return NextResponse.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "Failed to register user",
      },
      { status: statusCode },
    );
  }
}
