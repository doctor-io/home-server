import { createScheduledTask, listScheduledTasks } from "@/lib/server/modules/scheduled-tasks/service";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { z } from "zod";
import { CRON_EXPRESSION_REGEX, createScheduledTaskSchema } from "@/lib/shared/contracts/scheduled-tasks";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

async function authenticateRequest(request: NextRequest, requestId: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);
  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "scheduled-tasks.response",
      status: "error",
      requestId,
      message: "Unauthorized scheduled-tasks request",
    });
    return null;
  }
  return session;
}

export async function GET(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const session = await authenticateRequest(request, requestId);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tasks = await listScheduledTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "scheduled-tasks.get.response",
      status: "error",
      requestId,
      message: "Failed to fetch scheduled tasks",
      error,
    });
    return NextResponse.json({ error: "Failed to fetch scheduled tasks" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const session = await authenticateRequest(request, requestId);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createScheduledTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const task = await createScheduledTask(parsed.data);
    logServerAction({
      layer: "api",
      action: "scheduled-tasks.post.created",
      status: "success",
      requestId,
      message: "Created scheduled task",
      meta: { userId: session.userId, username: session.username, taskId: task.id, label: task.label },
    });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "scheduled-tasks.post.response",
      status: "error",
      requestId,
      message: "Failed to create scheduled task",
      error,
    });
    return NextResponse.json({ error: "Failed to create scheduled task" }, { status: 500 });
  }
}
