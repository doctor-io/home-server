import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  getHomeioLogs,
  getSystemLogs,
  getDockerLogs,
  type LogSource,
} from "@/lib/server/modules/logs/service";

export const runtime = "nodejs";

/**
 * GET /api/v1/logs?source=homeio|system|docker
 *
 * Returns recent log entries for the requested source.
 * - homeio: structured JSON entries from LOG_FILE_PATH
 * - system: journalctl (last 500 lines)
 * - docker: journalctl -u docker (last 500 lines)
 */
export async function GET(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  return withServerTiming(
    { layer: "api", action: "logs.get", requestId },
    async () => {
      const source = (request.nextUrl.searchParams.get("source") ??
        "homeio") as LogSource;

      if (!["homeio", "system", "docker"].includes(source)) {
        return NextResponse.json(
          { error: "Invalid source. Use homeio, system, or docker." },
          { status: 400 },
        );
      }

      const result =
        source === "homeio"
          ? await getHomeioLogs()
          : source === "system"
            ? await getSystemLogs()
            : await getDockerLogs();

      return NextResponse.json({ data: result });
    },
  );
}
