import { NextResponse } from "next/server";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { revokeApiToken } from "@/lib/server/modules/auth/api-token-repository";

export const runtime = "nodejs";

type Context = { params: Promise<{ tokenId: string }> };

/** Session-only, like the rest of token management: no scope is declared. */
export async function DELETE(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  const { tokenId } = await context.params;

  try {
    const revoked = await revokeApiToken(tokenId);
    if (!revoked) {
      return NextResponse.json({ error: "Token not found", code: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ data: { id: tokenId, revoked: true } });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.tokens.revoke",
      status: "error",
      requestId,
      message: "Failed to revoke an API token",
      error,
    });
    return NextResponse.json(
      { error: "Failed to revoke the token", code: "internal_error" },
      { status: 500 },
    );
  }
}
