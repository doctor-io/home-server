import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  NetworkServiceError,
  connectNetwork,
} from "@/lib/server/modules/network/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "network.connect.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const data = await connectNetwork(payload, {
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
      action: "network.connect.post.response",
      status: "error",
      requestId,
      message: "Unable to connect Wi-Fi network",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to connect Wi-Fi network",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
