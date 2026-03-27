import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { pruneDockerVolumes } from "@/lib/server/modules/docker/maintenance-service";

export const runtime = "nodejs";

async function authenticateRequest(request: NextRequest, requestId: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);

  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "docker.prune.volumes.response",
      status: "error",
      requestId,
      message: "Unauthorized Docker volume prune request",
    });
    return null;
  }

  return session;
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "docker.prune.volumes.post",
        requestId,
      },
      async () => {
        const session = await authenticateRequest(request, requestId);
        if (!session) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await pruneDockerVolumes();

        logServerAction({
          layer: "api",
          action: "docker.prune.volumes.post.completed",
          status: "success",
          requestId,
          message: "Completed Docker volume prune",
          meta: {
            userId: session.userId,
            username: session.username,
          },
        });

        return NextResponse.json({ data: result });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "docker.prune.volumes.post.response",
      status: "error",
      requestId,
      message: "Failed to prune Docker volumes",
      error,
    });

    return NextResponse.json({ error: "Failed to prune Docker volumes" }, { status: 500 });
  }
}
