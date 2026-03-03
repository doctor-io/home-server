import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getStoreOperation } from "@/lib/server/modules/apps/operations";

export const runtime = "nodejs";

type Context = {
  params: Promise<{
    operationId: string;
  }>;
};

export async function GET(_request: Request, context: Context) {
  const requestId = createRequestId();
  const { operationId } = await context.params;

  try {
    return await withServerTiming(
      {
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
