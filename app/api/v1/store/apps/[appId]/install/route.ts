import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

export const runtime = "nodejs";

const installSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  env: z.record(z.string(), z.string()).optional(),
  webUiPort: z.number().int().min(1).max(65535).optional(),
  composeSource: z.string().trim().min(1).max(500_000).optional(),
  resetToCatalog: z.boolean().optional(),
});

type Context = {
  params: Promise<{
    appId: string;
  }>;
};

export async function POST(request: Request, context: Context) {
  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.apps.install.post",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const parsed = installSchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid install payload",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const result = await startAppLifecycleAction({
          appId,
          action: "install",
          displayName: parsed.data.displayName,
          env: parsed.data.env,
          webUiPort: parsed.data.webUiPort,
          composeSource: parsed.data.composeSource,
          resetToCatalog: parsed.data.resetToCatalog,
        });

        return NextResponse.json(result, { status: 202 });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.apps.install.post.response",
      status: "error",
      requestId,
      message: "Unable to start install operation",
      error,
      meta: {
        appId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to start install operation",
      },
      { status: 500 },
    );
  }
}
