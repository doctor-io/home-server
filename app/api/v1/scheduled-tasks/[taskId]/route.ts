import {
  deleteScheduledTask,
  getScheduledTask,
  updateScheduledTask,
} from "@/lib/server/modules/scheduled-tasks/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = await getScheduledTask(taskId);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const body = await request.json();
  const task = await updateScheduledTask(taskId, body);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  await deleteScheduledTask(taskId);
  return NextResponse.json({ ok: true });
}
