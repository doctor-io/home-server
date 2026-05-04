import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  isStoreSourceClientError,
  refreshStoreCatalogSource,
} from "@/lib/server/modules/store/catalog";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sourceId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { sourceId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.sources.refresh.post",
        requestId,
        meta: { sourceId },
      },
      async () => {
        const source = await refreshStoreCatalogSource(sourceId);
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
      error instanceof Error ? error.message : "Unable to refresh store source";

    logServerAction({
      level: "error",
      layer: "api",
      action: "store.sources.refresh.post.response",
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
