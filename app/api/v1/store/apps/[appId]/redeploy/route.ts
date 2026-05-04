import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { StoreOperationError } from "@/lib/server/modules/apps/operations";

export const runtime = "nodejs";

const redeploySchema = z.object({
  env: z.record(z.string(), z.string()).optional(),
  webUiPort: z.number().int().min(1).max(65535).optional(),
  composeSource: z.string().trim().min(1).max(500_000).optional(),
});

type Context = {
  params: Promise<{
    appId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.apps.redeploy.post",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const parsed = redeploySchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid redeploy payload",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const result = await startAppLifecycleAction({
          appId,
          action: "redeploy",
          env: parsed.data.env,
          webUiPort: parsed.data.webUiPort,
          composeSource: parsed.data.composeSource,
        });

        return NextResponse.json(result, { status: 202 });
      },
    );
  } catch (error) {
    if (error instanceof StoreOperationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode },
      );
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "store.apps.redeploy.post.response",
      status: "error",
      requestId,
      message: "Unable to start redeploy operation",
      error,
      meta: {
        appId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to start redeploy operation",
      },
      { status: 500 },
    );
  }
}
