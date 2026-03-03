import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server/env";
import {
  buildSessionPayload,
  isSessionExpired,
  parseSessionToken,
} from "@/lib/shared/auth/session";

function signPayload(payload: string) {
  return createHmac("sha256", serverEnv.AUTH_SESSION_SECRET)
    .update(payload)
    .digest("hex");
}

export function createSessionToken(
  sessionId: string,
  expiresAtEpochSeconds: number,
) {
  const payload = buildSessionPayload(sessionId, expiresAtEpochSeconds);
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifySessionToken(token: string) {
  const parsed = parseSessionToken(token);
  if (!parsed) return null;
  if (isSessionExpired(parsed.expiresAtEpochSeconds)) return null;

  const expectedSignature = signPayload(parsed.payload);

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(parsed.signature, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return {
    sessionId: parsed.sessionId,
    expiresAtEpochSeconds: parsed.expiresAtEpochSeconds,
  };
}
