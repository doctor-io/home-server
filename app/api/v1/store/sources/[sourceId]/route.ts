import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  isStoreSourceClientError,
  removeStoreCatalogSource,
  updateStoreCatalogSource,
} from "@/lib/server/modules/store/catalog";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sourceId: string }>;
};

const updateSourceSchema = z.object({
  enabled: z.boolean(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { sourceId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.sources.update.patch",
        requestId,
        meta: { sourceId },
      },
      async () => {
        const payload = await request.json().catch(() => null);
        const parsed = updateSourceSchema.safeParse(payload);

        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid store source update payload" },
            { status: 400 },
          );
        }

        const source = await updateStoreCatalogSource(sourceId, parsed.data);
        return NextResponse.json(
          { data: source },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to update store source";

    logServerAction({
      level: "error",
      layer: "api",
      action: "store.sources.update.patch.response",
      status: "error",
      requestId,
      message,
      error,
      meta: { sourceId },
    });

    const status = /not found/i.test(message)
      ? 404
      : isStoreSourceClientError(message)
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { sourceId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.sources.delete",
        requestId,
        meta: { sourceId },
      },
      async () => {
        const source = await removeStoreCatalogSource(sourceId);
        return NextResponse.json(
          { data: source },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to delete store source";

    logServerAction({
      level: "error",
      layer: "api",
      action: "store.sources.delete.response",
      status: "error",
      requestId,
      message,
      error,
      meta: { sourceId },
    });

    const status = /not found/i.test(message)
      ? 404
      : isStoreSourceClientError(message)
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
