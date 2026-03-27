import "server-only";

import { AUTH_SESSION_COOKIE_NAME } from "@/lib/shared/auth/session";

export function getAuthCookieName() {
  return AUTH_SESSION_COOKIE_NAME;
}

function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded === "https";
  return new URL(request.url).protocol === "https:";
}

export function getSessionCookieOptions(expiresAt: Date, request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
    path: "/",
    expires: expiresAt,
  };
}

export function getExpiredSessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
    path: "/",
    expires: new Date(0),
  };
}
