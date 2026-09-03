import {
  AUTH_SESSION_COOKIE_NAME,
  isSessionExpired,
  parseSessionToken,
} from "@/lib/shared/auth/session";
import { type NextRequest, NextResponse } from "next/server";

const DEMO_MODE = process.env.DEMO_MODE === "true";
const DEMO_BLOCKED_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

const PUBLIC_ROUTES = new Set(["/login", "/register"]);
const RECOVERY_ROUTES = new Set(["/updating"]);
const AUTH_STATUS_CACHE_MS = 5_000;
let authStatusCache:
  | {
      hasUsers: boolean;
      expiresAt: number;
    }
  | null = null;

export function resetAuthStatusCacheForTests() {
  authStatusCache = null;
}

function isPublicApiRoute(pathname: string) {
  return (
    pathname === "/api/health" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/register" ||
    pathname === "/api/auth/status" ||
    // Second leg of the TOTP login flow. Caller has no session cookie yet —
    // only a short-lived partial-auth token. Route handler validates that
    // token itself; do not gate it on a session.
    pathname === "/api/v1/auth/login/totp" ||
    // M4: a phone spending a pairing code has no session cookie — that is what
    // the code buys it. The route handler decides whether the code is real,
    // unspent and unexpired; the proxy has no database and cannot.
    pathname === "/api/v1/auth/pairing/claim" ||
    pathname === "/api/v1/logs"
  );
}

/**
 * Only the presence of a bearer credential, not its validity. The route decides
 * whether the token is real, unrevoked, unexpired and scoped for what it asks.
 */
function hasBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization");
  return Boolean(header && /^bearer\s+\S/i.test(header.trim()));
}

function isStaticRoute(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/images/") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon.png" ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  );
}

async function signPayloadEdge(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  return Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }

  return mismatch === 0;
}

export async function verifySessionTokenInMiddleware(
  sessionToken: string | undefined,
  secret = process.env.AUTH_SESSION_SECRET ?? "dev-session-secret-change-me",
) {
  if (!sessionToken) return false;

  const parsed = parseSessionToken(sessionToken);
  if (!parsed) return false;
  if (isSessionExpired(parsed.expiresAtEpochSeconds)) return false;

  const expected = await signPayloadEdge(parsed.payload, secret);
  return safeEqual(expected, parsed.signature);
}

async function hasUsersInDb(request: NextRequest) {
  const now = Date.now();
  if (authStatusCache && authStatusCache.expiresAt > now) {
    return authStatusCache.hasUsers;
  }

  try {
    const response = await fetch(new URL("/api/auth/status", request.url), {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Auth status request failed");
    }

    const json = (await response.json()) as {
      data?: {
        hasUsers?: boolean;
      };
    };

    const hasUsers = typeof json.data?.hasUsers === "boolean" ? json.data.hasUsers : false;
    authStatusCache = {
      hasUsers,
      expiresAt: now + AUTH_STATUS_CACHE_MS,
    };
    return hasUsers;
  } catch {
    if (authStatusCache) {
      return authStatusCache.hasUsers;
    }
    return false;
  }
}

function getAuthEntryPath(hasUsers: boolean) {
  return hasUsers ? "/login" : "/register";
}

function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0),
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isStaticRoute(pathname)) {
    return NextResponse.next();
  }

  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  if (
    DEMO_MODE &&
    DEMO_BLOCKED_METHODS.has(request.method) &&
    pathname.startsWith("/api/v1/")
  ) {
    return NextResponse.json(
      { error: "This action is not available in demo mode." },
      { status: 403 },
    );
  }

  // A bearer-carrying API request is handed to the route, which validates the
  // token and the scope it requires. The proxy cannot do that check — it has
  // no database access — and refusing here would mean tokens never reach the
  // handlers that were written to accept them.
  if (pathname.startsWith("/api/v1/") && hasBearerToken(request)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionTokenInMiddleware(sessionToken);

  if (PUBLIC_ROUTES.has(pathname)) {
    const hasUsers = await hasUsersInDb(request);
    const expectedPublicPath = getAuthEntryPath(hasUsers);

    if (isAuthenticated) {
      if (!hasUsers) {
        if (pathname === "/register") {
          return clearSessionCookie(NextResponse.next());
        }

        return clearSessionCookie(
          NextResponse.redirect(new URL("/register", request.url)),
        );
      }

      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname !== expectedPublicPath) {
      return NextResponse.redirect(new URL(expectedPublicPath, request.url));
    }

    return NextResponse.next();
  }

  if (RECOVERY_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  if (isAuthenticated) {
    const hasUsers = await hasUsersInDb(request);

    if (!hasUsers) {
      if (pathname.startsWith("/api/")) {
        if (pathname === "/api/auth/me") {
          const response = NextResponse.json(
            {
              error: "Unauthorized",
              redirectTo: "/register",
            },
            { status: 401 },
          );
          response.headers.set("x-auth-entry", "/register");
          return clearSessionCookie(response);
        }

        return clearSessionCookie(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
      }

      return clearSessionCookie(
        NextResponse.redirect(new URL("/register", request.url)),
      );
    }
  }

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      if (pathname === "/api/auth/me") {
        const hasUsers = await hasUsersInDb(request);
        const authEntry = getAuthEntryPath(hasUsers);
        const response = NextResponse.json(
          {
            error: "Unauthorized",
            redirectTo: authEntry,
          },
          { status: 401 },
        );
        response.headers.set("x-auth-entry", authEntry);
        return response;
      }

      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasUsers = await hasUsersInDb(request);
    const authUrl = new URL(getAuthEntryPath(hasUsers), request.url);
    authUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
