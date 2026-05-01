import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAllContainersStats } from "@/lib/server/modules/docker/stats";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

/**
 * GET /api/v1/docker/stats
 *
 * Returns current stats for all Docker containers (CPU, memory, network, I/O).
 * Response shape: { data: { containers: ContainerStats[]; daemonAvailable: boolean } }
 */
export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "docker.stats.get",
        requestId,
      },
      async () => {
        const result = await getAllContainersStats();

        return NextResponse.json({
          data: result,
        });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "docker.stats.get.response",
      status: "error",
      requestId,
      message: "Failed to get Docker stats",
      error,
    });

    return NextResponse.json(
      {
        error: "Failed to get Docker stats",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
