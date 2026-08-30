/**
 * What a token is allowed to do. Nothing is granted implicitly: a token holds
 * exactly the scopes it was created with, and `system:power` is deliberately
 * separate because shutting a server down is not "managing apps".
 */
export const API_TOKEN_SCOPES = [
  "read:metrics",
  "read:apps",
  "write:apps",
  "read:files",
  "write:files",
  "system:power",
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

export const API_TOKEN_SCOPE_LABELS: Record<ApiTokenScope, string> = {
  "read:metrics": "Read system metrics",
  "read:apps": "See installed apps",
  "write:apps": "Start, stop and install apps",
  "read:files": "Read files",
  "write:files": "Write and delete files",
  "system:power": "Shut down and restart the server",
};

export type ApiToken = {
  id: string;
  name: string;
  /** First characters of the token, shown so a row can be recognised. */
  prefix: string;
  scopes: ApiTokenScope[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  createdAt: string;
  revokedAt: string | null;
};

/** Returned once, at creation. The full value is never readable again. */
export type ApiTokenWithSecret = ApiToken & {
  token: string;
};

export function isApiTokenScope(value: unknown): value is ApiTokenScope {
  return typeof value === "string" && (API_TOKEN_SCOPES as readonly string[]).includes(value);
}

/** Unused for this long and it is probably a forgotten integration. */
export const API_TOKEN_STALE_DAYS = 90;

export function isStale(token: ApiToken, now = new Date()): boolean {
  if (token.revokedAt) return false;
  const reference = token.lastUsedAt ?? token.createdAt;
  const age = now.getTime() - new Date(reference).getTime();
  return age > API_TOKEN_STALE_DAYS * 24 * 3_600_000;
}
