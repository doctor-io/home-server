import {
  AUTH_SESSION_COOKIE_NAME,
  isSessionExpired,
  parseSessionToken,
} from "@/lib/shared/auth/session";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = new Set(["/login", "/register"]);
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
    pathname === "/api/v1/logs"
  );
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

    const hasUsers = typeof json.data?.hasUsers === "boolean" ? json.data.hasUsers : true;
    authStatusCache = {
      hasUsers,
      expiresAt: now + AUTH_STATUS_CACHE_MS,
    };
    return hasUsers;
  } catch {
    return true;
  }
}

function getAuthEntryPath(hasUsers: boolean) {
  return hasUsers ? "/login" : "/register";
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isStaticRoute(pathname)) {
    return NextResponse.next();
  }

  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE_NAME)?.value;
  const isAuthenticated = await verifySessionTokenInMiddleware(sessionToken);

  if (PUBLIC_ROUTES.has(pathname)) {
    const hasUsers = await hasUsersInDb(request);
    const expectedPublicPath = getAuthEntryPath(hasUsers);

    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (pathname !== expectedPublicPath) {
      return NextResponse.redirect(new URL(expectedPublicPath, request.url));
    }

    return NextResponse.next();
  }

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
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
