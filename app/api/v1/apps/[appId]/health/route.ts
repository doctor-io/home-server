import { NextResponse } from "next/server";
import { z } from "zod";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  defaultHealth,
  findAppHealth,
  saveAppHealthPolicy,
} from "@/lib/server/modules/apps/health-repository";
import { RESTART_POLICIES } from "@/lib/shared/contracts/app-health";

export const runtime = "nodejs";

type Context = { params: Promise<{ appId: string }> };

const policySchema = z.object({
  policy: z.enum(RESTART_POLICIES),
  maxRestarts: z.number().int().min(1).max(50).optional(),
  windowMinutes: z.number().int().min(1).max(1440).optional(),
  // Null clears a mute; a timestamp sets one. Absent leaves it as it was.
  mutedUntil: z.string().datetime().nullable().optional(),
});

export async function GET(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    // An app that was never configured is not an error: it simply has the
    // default policy, which is to leave the container alone.
    const health = (await findAppHealth(appId)) ?? defaultHealth(appId);
    return NextResponse.json({ data: health });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "apps.health.get",
      status: "error",
      requestId,
      message: "Failed to read app health",
      error,
    });
    return NextResponse.json(
      { error: "Failed to read app health", code: "internal_error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    const parsed = policySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid health policy payload", code: "validation_error" },
        { status: 400 },
      );
    }

    await saveAppHealthPolicy(appId, parsed.data);
    const health = (await findAppHealth(appId)) ?? defaultHealth(appId);

    return NextResponse.json({ data: health });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "apps.health.put",
      status: "error",
      requestId,
      message: "Failed to save app health policy",
      error,
    });
    return NextResponse.json(
      { error: "Failed to save the restart policy", code: "internal_error" },
      { status: 500 },
    );
  }
}
