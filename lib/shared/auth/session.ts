export const AUTH_SESSION_COOKIE_NAME = "homeio_session";

export type SessionTokenParts = {
  payload: string;
  sessionId: string;
  expiresAtEpochSeconds: number;
  signature: string;
};

export function buildSessionPayload(
  sessionId: string,
  expiresAtEpochSeconds: number,
) {
  return `${sessionId}.${expiresAtEpochSeconds}`;
}

export function parseSessionToken(token: string): SessionTokenParts | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [sessionId, expiresAtRaw, signature] = parts;
  const expiresAtEpochSeconds = Number(expiresAtRaw);

  if (!sessionId || !Number.isFinite(expiresAtEpochSeconds) || !signature) {
    return null;
  }

  return {
    payload: buildSessionPayload(sessionId, expiresAtEpochSeconds),
    sessionId,
    expiresAtEpochSeconds,
    signature,
  };
}

export function isSessionExpired(expiresAtEpochSeconds: number) {
  return Date.now() >= expiresAtEpochSeconds * 1000;
}
