import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { saveAppSettings } from "@/lib/server/modules/store/service";

export const runtime = "nodejs";

const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  env: z.record(z.string(), z.string()).optional(),
  webUiPort: z.number().int().min(1024).max(65535).optional(),
});

type Context = {
  params: Promise<{
    appId: string;
  }>;
};

export async function PATCH(request: Request, context: Context) {
  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.apps.settings.patch",
        requestId,
        meta: {
          appId,
        },
      },
      async () => {
        const parsed = settingsSchema.safeParse(await request.json());

        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid settings payload",
              issues: parsed.error.flatten(),
            },
            { status: 400 },
          );
        }

        const result = await saveAppSettings({
          appId,
          ...parsed.data,
        });

        return NextResponse.json(
          {
            saved: true,
            operationId: result.operationId,
          },
          { status: 200 },
        );
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.apps.settings.patch.response",
      status: "error",
      requestId,
      message: "Failed to save app settings",
      error,
    });

    return NextResponse.json(
      {
        error: "Failed to save app settings",
      },
      { status: 500 },
    );
  }
}
