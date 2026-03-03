import { type NextRequest, NextResponse } from "next/server";
import {
  createRequestId,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  getAuthCookieName,
  getExpiredSessionCookieOptions,
} from "@/lib/server/modules/auth/cookies";
import { logoutSession } from "@/lib/server/modules/auth/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;

  await withServerTiming(
    {
      layer: "api",
      action: "auth.logout",
      requestId,
    },
    async () => {
      await logoutSession(sessionToken);
      return Promise.resolve();
    },
  );

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set(
    getAuthCookieName(),
    "",
    getExpiredSessionCookieOptions(),
  );

  return response;
}
