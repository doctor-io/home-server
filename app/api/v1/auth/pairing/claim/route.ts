import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthCookieName, getSessionCookieOptions } from "@/lib/server/modules/auth/cookies";
import { PairingError, claimPairingCode } from "@/lib/server/modules/auth/pairing-service";
import {
  getLoginRateLimitKey,
  isLoginRateLimited,
  recordLoginFailure,
} from "@/lib/server/modules/auth/rate-limit";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";

export const runtime = "nodejs";

const claimSchema = z.object({ code: z.string().min(1).max(256) });

function clientIpOf(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Spends a pairing code and answers with a session cookie.
 *
 * **This route is deliberately unauthenticated**, and it is the only one added
 * to that set since v1.7 — a phone claiming a code has no session yet, which is
 * the entire point. What keeps it narrow: the code is 256 bits, it is single
 * use, it dies after a minute, it can only have been minted by an operator who
 * was already signed in, and failures here are rate limited on the same limiter
 * the login page uses.
 */
export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      { layer: "api", action: "auth.pairing.claim", requestId },
      async () => {
        const parsed = claimSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid pairing code", code: "invalid_code" },
            { status: 400 },
          );
        }

        // Keyed by address alone: a guesser rotates codes, so keying on the
        // code would hand out a fresh allowance for every attempt.
        const rateLimitKey = getLoginRateLimitKey(request, "pairing");
        if (isLoginRateLimited(rateLimitKey)) {
          return NextResponse.json(
            { error: "Too many pairing attempts", code: "rate_limited" },
            { status: 429 },
          );
        }

        try {
          const claim = await claimPairingCode(parsed.data.code, clientIpOf(request));

          const response = NextResponse.json({
            data: { expiresAt: claim.expiresAt.toISOString() },
          });
          response.cookies.set(
            getAuthCookieName(),
            claim.token,
            getSessionCookieOptions(claim.expiresAt, request),
          );
          return response;
        } catch (error) {
          if (error instanceof PairingError) {
            recordLoginFailure(rateLimitKey);
            return NextResponse.json(
              { error: error.message, code: error.code },
              { status: 401 },
            );
          }
          throw error;
        }
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.pairing.claim.response",
      status: "error",
      requestId,
      message: "Unable to claim a pairing code",
      error,
    });

    return NextResponse.json(
      { error: "Unable to claim a pairing code", code: "internal_error" },
      { status: 500 },
    );
  }
}
