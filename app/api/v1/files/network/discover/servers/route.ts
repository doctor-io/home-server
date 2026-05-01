import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  discoverServers,
  NetworkStorageError,
  startNetworkStorageWatcher,
} from "@/lib/server/modules/files/network-storage";

export const runtime = "nodejs";

startNetworkStorageWatcher();

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.network.discover.servers.get",
        requestId,
      },
      async () => {
        const data = await discoverServers();

        return NextResponse.json(
          {
            data,
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
    if (error instanceof NetworkStorageError) {
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
      action: "files.network.discover.servers.get.response",
      status: "error",
      requestId,
      message: "Unable to discover SMB servers",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to discover SMB servers",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
