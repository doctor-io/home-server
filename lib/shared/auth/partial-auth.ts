/**
 * Wire format for the short-lived token issued after a password-valid login
 * when the user has TOTP enabled. The token is the entire authentication
 * state — it is never persisted — and only proves "this caller knew the
 * password ~5 minutes ago". Calling `/api/v1/auth/login/totp` with a valid
 * partial token plus a valid TOTP/backup code is what flips it into a real
 * session.
 *
 * Token form: `partial.<userId>.<expiresAtEpochSeconds>.<hmac>`
 * Signed bytes: `partial.<userId>.<expiresAtEpochSeconds>`
 *
 * The literal `partial` segment is duplicated on purpose. It is the
 * structural discriminator (parser rejects anything else in segment 0) AND
 * part of the signed payload — so even with the same HMAC secret, a session
 * token and a partial-auth token cannot be cross-replayed because their
 * signed inputs are shaped differently.
 */

export const PARTIAL_AUTH_TOKEN_PREFIX = "partial";
export const PARTIAL_AUTH_TOKEN_TTL_SECONDS = 5 * 60;

export type PartialAuthTokenParts = {
  payload: string;
  userId: string;
  expiresAtEpochSeconds: number;
  signature: string;
};

export function buildPartialAuthPayload(
  userId: string,
  expiresAtEpochSeconds: number,
) {
  return `${PARTIAL_AUTH_TOKEN_PREFIX}.${userId}.${expiresAtEpochSeconds}`;
}

export function parsePartialAuthToken(
  token: string,
): PartialAuthTokenParts | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;

  const [prefix, userId, expiresAtRaw, signature] = parts;
  if (prefix !== PARTIAL_AUTH_TOKEN_PREFIX) return null;

  const expiresAtEpochSeconds = Number(expiresAtRaw);
  if (!userId || !Number.isFinite(expiresAtEpochSeconds) || !signature) {
    return null;
  }

  return {
    payload: buildPartialAuthPayload(userId, expiresAtEpochSeconds),
    userId,
    expiresAtEpochSeconds,
    signature,
  };
}

export function isPartialAuthExpired(expiresAtEpochSeconds: number) {
  return Date.now() >= expiresAtEpochSeconds * 1000;
}
