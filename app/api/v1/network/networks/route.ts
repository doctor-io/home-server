import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  NetworkServiceError,
  getWifiNetworks,
} from "@/lib/server/modules/network/service";

export const runtime = "nodejs";

export async function GET() {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "network.networks.get",
        requestId,
      },
      async () => {
        const result = await getWifiNetworks({
          requestId,
        });

        return NextResponse.json(
          {
            data: result.data,
            meta: {
              source: result.source,
              count: result.data.length,
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
      action: "network.networks.get.response",
      status: "error",
      requestId,
      message: "Unable to load Wi-Fi networks",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to load Wi-Fi networks",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
