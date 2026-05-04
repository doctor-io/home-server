import "server-only";

import { NextResponse } from "next/server";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";

export type ApiSession = NonNullable<Awaited<ReturnType<typeof authenticateSession>>>;

export type ApiSessionResult =
  | {
      session: ApiSession;
      response: null;
    }
  | {
      session: null;
      response: NextResponse;
    };

function parseCookies(headerValue: string | null) {
  const cookies: Record<string, string> = {};
  if (!headerValue) return cookies;

  for (const segment of headerValue.split(";")) {
    const [rawKey, ...rawValueParts] = segment.split("=");
    const key = rawKey?.trim();
    if (!key) continue;

    const rawValue = rawValueParts.join("=").trim();
    if (!rawValue) continue;

    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }
  }

  return cookies;
}

function getSessionTokenFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return cookies[getAuthCookieName()] ?? null;
}

export async function requireApiSession(request: Request): Promise<ApiSessionResult> {
  const session = await authenticateSession(getSessionTokenFromRequest(request));

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return {
    session,
    response: null,
  };
}
