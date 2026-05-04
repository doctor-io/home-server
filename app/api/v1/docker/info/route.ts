import { NextResponse } from "next/server";
import {
  createRequestId,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getDockerInfo } from "@/lib/server/modules/docker/stats";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

/**
 * GET /api/v1/docker/info
 *
 * Returns Docker engine metadata (version, storage driver, cgroup driver, image count).
 * Returns 503 when the Docker daemon socket is unreachable.
 */
export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  return withServerTiming(
    {
      layer: "api",
      action: "docker.info.get",
      requestId,
    },
    async () => {
      const info = await getDockerInfo();

      if (!info) {
        return NextResponse.json(
          { error: "Docker daemon unavailable" },
          { status: 503 },
        );
      }

      return NextResponse.json({ data: info });
    },
  );
}
