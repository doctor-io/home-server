import { runScheduledTask } from "@/lib/server/modules/scheduled-tasks/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  await runScheduledTask(taskId);
  return NextResponse.json({ ok: true });
}
