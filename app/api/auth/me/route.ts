import { type NextRequest, NextResponse } from "next/server";
import {
  createRequestId,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  const session = await withServerTiming(
    {
      layer: "api",
      action: "auth.me",
      requestId,
    },
    async () => authenticateSession(sessionToken),
  );

  if (!session) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    data: {
      id: session.userId,
      username: session.username,
    },
  });
}
