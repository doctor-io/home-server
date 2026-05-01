import { runScheduledTask } from "@/lib/server/modules/scheduled-tasks/service";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);
  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "scheduled-tasks.run.response",
      status: "error",
      requestId,
      message: "Unauthorized scheduled-task run request",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  try {
    await runScheduledTask(taskId);
    logServerAction({
      layer: "api",
      action: "scheduled-tasks.run.post.completed",
      status: "success",
      requestId,
      message: "Ran scheduled task",
      meta: { userId: session.userId, username: session.username, taskId },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "scheduled-tasks.run.post.response",
      status: "error",
      requestId,
      message: "Failed to run scheduled task",
      error,
      meta: { taskId },
    });
    return NextResponse.json({ error: "Failed to run scheduled task" }, { status: 500 });
  }
}
