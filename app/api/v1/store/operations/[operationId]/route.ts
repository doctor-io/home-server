import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getStoreOperation } from "@/lib/server/modules/apps/operations";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    operationId: string;
  }>;
};

export async function GET(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { operationId } = await context.params;

  try {
    return await withServerTiming(
      {
        level: "debug",
        layer: "api",
        action: "store.operations.get",
        requestId,
        meta: {
          operationId,
        },
      },
      async () => {
        const operation = await getStoreOperation(operationId);
        if (!operation) {
          return NextResponse.json(
            {
              error: "Operation not found",
            },
            { status: 404 },
          );
        }

        return NextResponse.json(
          {
            data: operation,
          },
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
      action: "store.operations.get.response",
      status: "error",
      requestId,
      message: "Unable to fetch operation status",
      error,
      meta: {
        operationId,
      },
    });

    return NextResponse.json(
      {
        error: "Unable to fetch operation status",
      },
      { status: 500 },
    );
  }
}
