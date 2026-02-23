import { z } from "zod";
import { type NextRequest, NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { AuthError, verifyUnlockPassword } from "@/lib/server/modules/auth/service";

export const runtime = "nodejs";

const unlockSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  try {
    const body = await request.json();
    const parsed = unlockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
        },
        { status: 400 },
      );
    }

    await withServerTiming(
      {
        layer: "api",
        action: "auth.unlock",
        requestId,
      },
      async () => {
        await verifyUnlockPassword({
          sessionToken,
          password: parsed.data.password,
        });
      },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const statusCode = error instanceof AuthError ? error.statusCode : 500;

    logServerAction({
      level: statusCode >= 500 ? "error" : "warn",
      layer: "api",
      action: "auth.unlock",
      status: "error",
      requestId,
      error,
    });

    return NextResponse.json(
      {
        error: error instanceof AuthError ? error.message : "Unlock failed",
      },
      { status: statusCode },
    );
  }
}
