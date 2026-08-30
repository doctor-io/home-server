import "server-only";

import { NextResponse } from "next/server";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { findApiTokenByPrefix, touchApiToken } from "@/lib/server/modules/auth/api-token-repository";
import {
  hasScope,
  isUsable,
  prefixOf,
  verifyToken,
} from "@/lib/server/modules/auth/api-token-service";
import type { ApiTokenScope } from "@/lib/shared/contracts/api-tokens";

export type ApiSession = NonNullable<Awaited<ReturnType<typeof authenticateSession>>>;

export type ApiSessionResult =
  | {
      session: ApiSession;
      response: null;
      /** Set when the caller authenticated with a token rather than a cookie. */
      tokenId?: string;
      scopes?: ApiTokenScope[];
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

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header) return null;

  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme.toLowerCase() !== "bearer") return null;

  const value = rest.join("");
  return value.length > 0 ? value : null;
}

function clientIpOf(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Authenticates a request.
 *
 * The session cookie is tried first and its path is unchanged, so browser
 * traffic behaves exactly as it did before tokens existed.
 *
 * A bearer token is accepted **only** when the route names the scope it
 * requires. A route that says nothing keeps refusing tokens, so adding token
 * auth to the codebase cannot quietly open an endpoint nobody reviewed.
 */
export async function requireApiSession(
  request: Request,
  options?: { scope?: ApiTokenScope },
): Promise<ApiSessionResult> {
  const session = await authenticateSession(getSessionTokenFromRequest(request));
  if (session) {
    return { session, response: null };
  }

  const bearer = getBearerToken(request);
  if (!bearer || !options?.scope) {
    return { session: null, response: unauthorized() };
  }

  const record = await findApiTokenByPrefix(prefixOf(bearer));
  if (!record || !isUsable(record)) {
    return { session: null, response: unauthorized() };
  }

  if (!(await verifyToken(bearer, record.tokenHash))) {
    return { session: null, response: unauthorized() };
  }

  if (!hasScope(record.scopes, options.scope)) {
    // Distinguished from "not authenticated": the credential is real, it just
    // does not carry this permission, and a 401 would send a client into a
    // pointless re-auth loop.
    return {
      session: null,
      response: NextResponse.json(
        { error: `This token lacks the ${options.scope} scope`, code: "insufficient_scope" },
        { status: 403 },
      ),
    };
  }

  // Best-effort: a usage stamp is not worth failing a request over.
  void touchApiToken(record.id, clientIpOf(request)).catch(() => {});

  return {
    // Token callers act as the single account, so downstream code that expects
    // a session keeps working unchanged.
    session: {
      sessionId: `token:${record.id}`,
      userId: `token:${record.id}`,
      username: record.name,
      passwordHash: "",
      expiresAt: record.expiresAt ? new Date(record.expiresAt) : new Date(Date.now() + 3_600_000),
    } as ApiSession,
    response: null,
    tokenId: record.id,
    scopes: record.scopes,
  };
}
