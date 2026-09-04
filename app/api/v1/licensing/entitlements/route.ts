import { NextResponse } from "next/server";
import {
  createRequestId,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { getEntitlementsSnapshot } from "@/lib/server/modules/licensing/entitlements-service";

export const runtime = "nodejs";

/**
 * GET /api/v1/licensing/entitlements
 *
 * What this server is licensed for. Never returns the licence token itself —
 * the UI needs the entitlements, not the credential that granted them.
 */
export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  return withServerTiming(
    {
      level: "debug",
      layer: "api",
      action: "licensing.entitlements.get",
      requestId,
    },
    async () => {
      const snapshot = getEntitlementsSnapshot();

      return NextResponse.json(
        { data: snapshot },
        // A licence can lapse between two reads, so this must not be cached.
        { headers: { "Cache-Control": "no-store" } },
      );
    },
  );
}
