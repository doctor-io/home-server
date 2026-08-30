import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createApiToken,
  listApiTokens,
} from "@/lib/server/modules/auth/api-token-repository";
import {
  generateApiToken,
  normalizeScopes,
} from "@/lib/server/modules/auth/api-token-service";
import { API_TOKEN_SCOPES } from "@/lib/shared/contracts/api-tokens";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_TOKEN_SCOPES)).min(1),
  expiresAt: z.string().datetime().nullable().optional(),
});

// Deliberately no `scope` option on requireApiSession here: these routes are
// session-only, so a token can never mint another token or read the list of
// them. K2's default-deny gives that for free — the omission is the mechanism.
export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    return NextResponse.json({ data: await listApiTokens() });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.tokens.list",
      status: "error",
      requestId,
      message: "Failed to list API tokens",
      error,
    });
    return NextResponse.json(
      { error: "Failed to list tokens", code: "internal_error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid token payload", code: "validation_error" },
        { status: 400 },
      );
    }

    const generated = await generateApiToken();
    const token = await createApiToken({
      id: generated.id,
      name: parsed.data.name,
      prefix: generated.prefix,
      tokenHash: generated.tokenHash,
      scopes: normalizeScopes(parsed.data.scopes),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });

    // The only time the full value is ever returned. Nothing stores it, so
    // nothing can hand it back later.
    return NextResponse.json({ data: { ...token, token: generated.token } }, { status: 201 });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.tokens.create",
      status: "error",
      requestId,
      message: "Failed to create an API token",
      error,
    });
    return NextResponse.json(
      { error: "Failed to create the token", code: "internal_error" },
      { status: 500 },
    );
  }
}
