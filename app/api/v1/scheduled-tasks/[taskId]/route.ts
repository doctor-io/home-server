import {
  deleteScheduledTask,
  getScheduledTask,
  updateScheduledTask,
} from "@/lib/server/modules/scheduled-tasks/service";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthCookieName } from "@/lib/server/modules/auth/cookies";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { updateScheduledTaskSchema } from "@/lib/shared/contracts/scheduled-tasks";

export const runtime = "nodejs";

async function authenticateRequest(request: NextRequest, requestId: string) {
  const sessionToken = request.cookies.get(getAuthCookieName())?.value;
  const session = await authenticateSession(sessionToken);
  if (!session) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "scheduled-tasks.taskId.response",
      status: "error",
      requestId,
      message: "Unauthorized scheduled-tasks request",
    });
    return null;
  }
  return session;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestId = createRequestId();
  const session = await authenticateRequest(request, requestId);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const task = await getScheduledTask(taskId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestId = createRequestId();
  const session = await authenticateRequest(request, requestId);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateScheduledTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { taskId } = await params;
  try {
    const task = await updateScheduledTask(taskId, parsed.data);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    logServerAction({
      layer: "api",
      action: "scheduled-tasks.patch.updated",
      status: "success",
      requestId,
      message: "Updated scheduled task",
      meta: { userId: session.userId, username: session.username, taskId },
    });
    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: "Failed to update scheduled task" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  const requestId = createRequestId();
  const session = await authenticateRequest(request, requestId);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  try {
    await deleteScheduledTask(taskId);
    logServerAction({
      layer: "api",
      action: "scheduled-tasks.delete.deleted",
      status: "success",
      requestId,
      message: "Deleted scheduled task",
      meta: { userId: session.userId, username: session.username, taskId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete scheduled task" }, { status: 500 });
  }
}
