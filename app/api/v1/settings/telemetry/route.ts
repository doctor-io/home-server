import { NextResponse } from "next/server";
import {
  getTelemetryEnabled,
  setTelemetryEnabled,
} from "@/lib/server/modules/telemetry/posthog";

export const runtime = "nodejs";

export async function GET() {
  const enabled = await getTelemetryEnabled();
  return NextResponse.json({ enabled });
}

export async function POST(request: Request) {
  const body = await request.json() as { enabled: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  await setTelemetryEnabled(body.enabled);
  return NextResponse.json({ ok: true });
}
