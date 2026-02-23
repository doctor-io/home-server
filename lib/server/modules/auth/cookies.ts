import "server-only";

import { serverEnv } from "@/lib/server/env";
import { AUTH_SESSION_COOKIE_NAME } from "@/lib/shared/auth/session";

export function getAuthCookieName() {
  return AUTH_SESSION_COOKIE_NAME;
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: serverEnv.AUTH_COOKIE_SECURE,
    path: "/",
    expires: expiresAt,
  };
}

export function getExpiredSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: serverEnv.AUTH_COOKIE_SECURE,
    path: "/",
    expires: new Date(0),
  };
}
