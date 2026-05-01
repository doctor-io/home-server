import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  addStoreCatalogSource,
  isStoreSourceClientError,
  listStoreCatalogSources,
} from "@/lib/server/modules/store/catalog";

export const runtime = "nodejs";

const createSourceSchema = z.object({
  url: z.string().trim().url(),
  name: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.sources.list.get",
        requestId,
      },
      async () => {
        const sources = await listStoreCatalogSources();
        return NextResponse.json(
          { data: sources },
          {
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.sources.list.get.response",
      status: "error",
      requestId,
      message: "Unable to load store sources",
      error,
    });

    return NextResponse.json(
      { error: "Unable to load store sources" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.sources.create.post",
        requestId,
      },
      async () => {
        const payload = await request.json().catch(() => null);
        const parsed = createSourceSchema.safeParse(payload);

        if (!parsed.success) {
          return NextResponse.json(
            { error: "Invalid store source payload" },
            { status: 400 },
          );
        }

        const source = await addStoreCatalogSource(parsed.data);
        return NextResponse.json(
          { data: source },
          {
            status: 201,
            headers: {
              "Cache-Control": "no-store",
            },
          },
        );
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to add store source";

    logServerAction({
      level: "error",
      layer: "api",
      action: "store.sources.create.post.response",
      status: "error",
      requestId,
      message,
      error,
    });

    return NextResponse.json(
      { error: message },
      { status: isStoreSourceClientError(message) ? 400 : 500 },
    );
  }
}
