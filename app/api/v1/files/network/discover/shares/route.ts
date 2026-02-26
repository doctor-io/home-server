import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  discoverShares,
  NetworkStorageError,
  startNetworkStorageWatcher,
} from "@/lib/server/modules/files/network-storage";

export const runtime = "nodejs";

const discoverSharesSchema = z.object({
  host: z.string().trim().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

startNetworkStorageWatcher();

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.network.discover.shares.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const parsed = discoverSharesSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid share discovery payload",
              code: "invalid_path",
            },
            {
              status: 400,
            },
          );
        }

        const data = await discoverShares(parsed.data);

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
      action: "files.network.discover.shares.post.response",
      status: "error",
      requestId,
      message: "Unable to discover SMB shares",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to discover SMB shares",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
