import { createScheduledTask, listScheduledTasks } from "@/lib/server/modules/scheduled-tasks/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const tasks = await listScheduledTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const body = await request.json();
  const task = await createScheduledTask(body);
  return NextResponse.json({ task }, { status: 201 });
}
