import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  NetworkServiceError,
  getNetworkStatus,
} from "@/lib/server/modules/network/service";

export const runtime = "nodejs";

export async function GET() {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "network.status.get",
        requestId,
      },
      async () => {
        const result = await getNetworkStatus({
          requestId,
        });

        return NextResponse.json(
          {
            data: result.data,
            meta: {
              source: result.source,
            },
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
    if (error instanceof NetworkServiceError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: error.statusCode,
        },
      );
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "network.status.get.response",
      status: "error",
      requestId,
      message: "Unable to load network status",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to load network status",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
