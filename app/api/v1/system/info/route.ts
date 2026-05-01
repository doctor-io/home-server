import { NextResponse } from "next/server";
import { createRequestId, withServerTiming } from "@/lib/server/logging/logger";
import { getServerHardwareInfo } from "@/lib/server/modules/system/info-service";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  return withServerTiming(
    { layer: "api", action: "system.info.get", requestId },
    async () => {
      const info = await getServerHardwareInfo();
      return NextResponse.json({ data: info }, { headers: { "Cache-Control": "no-store" } });
    },
  );
}
