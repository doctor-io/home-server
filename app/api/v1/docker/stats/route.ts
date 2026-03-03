import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAllContainersStats } from "@/lib/server/modules/docker/stats";

export const runtime = "nodejs";

/**
 * GET /api/v1/docker/stats
 *
 * Returns current stats for all Docker containers (CPU, memory, network, I/O)
 */
export async function GET() {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "docker.stats.get",
        requestId,
      },
      async () => {
        const stats = await getAllContainersStats();

        return NextResponse.json({
          data: stats,
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
