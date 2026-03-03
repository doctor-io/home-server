import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  addLocalFolderShare,
  listLocalFolderShares,
  LocalSharingError,
} from "@/lib/server/modules/files/local-sharing";

export const runtime = "nodejs";

const createLocalShareSchema = z.object({
  path: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
});

export async function GET() {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.shared.folders.get",
        requestId,
      },
      async () => {
        const data = await listLocalFolderShares();

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
    if (error instanceof LocalSharingError) {
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
      action: "files.shared.folders.get.response",
      status: "error",
      requestId,
      message: "Unable to load shared folders",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to load shared folders",
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
        action: "files.shared.folders.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const parsed = createLocalShareSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid shared folder payload",
              code: "invalid_path",
            },
            {
              status: 400,
            },
          );
        }

        const data = await addLocalFolderShare(parsed.data);

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
    if (error instanceof LocalSharingError) {
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
      action: "files.shared.folders.post.response",
      status: "error",
      requestId,
      message: "Unable to share folder",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to share folder",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
