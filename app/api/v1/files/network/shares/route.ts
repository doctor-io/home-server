import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  addShare,
  getShareInfo,
  NetworkStorageError,
  startNetworkStorageWatcher,
} from "@/lib/server/modules/files/network-storage";

export const runtime = "nodejs";

const createNetworkShareSchema = z.object({
  host: z.string().trim().min(1),
  share: z.string().trim().min(1),
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

startNetworkStorageWatcher();

export async function GET() {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.network.shares.get",
        requestId,
      },
      async () => {
        const data = await getShareInfo();

        return NextResponse.json(
          {
            data,
            meta: {
              count: data.length,
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
      action: "files.network.shares.get.response",
      status: "error",
      requestId,
      message: "Unable to load network shares",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to load network shares",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.network.shares.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const parsed = createNetworkShareSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid network share payload",
              code: "invalid_path",
            },
            {
              status: 400,
            },
          );
        }

        const data = await addShare(parsed.data);

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
      action: "files.network.shares.post.response",
      status: "error",
      requestId,
      message: "Unable to create network share",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to create network share",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
