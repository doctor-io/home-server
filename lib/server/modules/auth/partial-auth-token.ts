import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/server/env";
import {
  PARTIAL_AUTH_TOKEN_TTL_SECONDS,
  buildPartialAuthPayload,
  isPartialAuthExpired,
  parsePartialAuthToken,
} from "@/lib/shared/auth/partial-auth";

function signPayload(payload: string) {
  return createHmac("sha256", serverEnv.AUTH_SESSION_SECRET)
    .update(payload)
    .digest("hex");
}

export type PartialAuthIssued = {
  token: string;
  expiresAtEpochSeconds: number;
};

/**
 * Issues a partial-auth token for `userId` that expires in
 * {@link PARTIAL_AUTH_TOKEN_TTL_SECONDS}. Uses {@link Date.now} for the
 * timestamp; tests can wrap by mocking the system clock.
 */
export function createPartialAuthToken(userId: string): PartialAuthIssued {
  const expiresAtEpochSeconds =
    Math.floor(Date.now() / 1000) + PARTIAL_AUTH_TOKEN_TTL_SECONDS;
  const payload = buildPartialAuthPayload(userId, expiresAtEpochSeconds);
  const signature = signPayload(payload);
  return {
    token: `${payload}.${signature}`,
    expiresAtEpochSeconds,
  };
}

/**
 * Returns `{ userId }` for a valid, unexpired partial-auth token, or `null`
 * if the token is malformed, expired, or carries a bad signature. The
 * `partial.` prefix is in the signed bytes, so a session token cannot be
 * re-presented here even though both formats use {@link AUTH_SESSION_SECRET}.
 */
export function verifyPartialAuthToken(token: string) {
  const parsed = parsePartialAuthToken(token);
  if (!parsed) return null;
  if (isPartialAuthExpired(parsed.expiresAtEpochSeconds)) return null;

  const expectedSignature = signPayload(parsed.payload);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const actualBuffer = Buffer.from(parsed.signature, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) return null;
  if (!timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  return {
    userId: parsed.userId,
    expiresAtEpochSeconds: parsed.expiresAtEpochSeconds,
  };
}
