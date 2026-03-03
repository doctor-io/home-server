import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

export const runtime = "nodejs";

const uninstallSchema = z.object({
  removeVolumes: z.boolean().optional(),
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
        action: "store.apps.uninstall.post",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const parsed = uninstallSchema.safeParse(await request.json());
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid uninstall payload",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const result = await startAppLifecycleAction({
          appId,
          action: "uninstall",
          removeVolumes: parsed.data.removeVolumes,
        });

        return NextResponse.json(result, { status: 202 });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.apps.uninstall.post.response",
      status: "error",
      requestId,
      message: "Unable to start uninstall operation",
      error,
      meta: {
        appId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to start uninstall operation",
      },
      { status: 500 },
    );
  }
}
