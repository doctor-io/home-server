import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  NetworkServiceError,
  disconnectNetwork,
} from "@/lib/server/modules/network/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "network.disconnect.post",
        requestId,
      },
      async () => {
        const payload = await request.json().catch(() => ({}));
        const data = await disconnectNetwork(payload, {
          requestId,
        });

        return NextResponse.json(
          {
            data,
          },
          {
            status: 202,
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
      action: "network.disconnect.post.response",
      status: "error",
      requestId,
      message: "Unable to disconnect Wi-Fi network",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to disconnect Wi-Fi network",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
