import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { getFilesRootInfo } from "@/lib/server/modules/files/path-resolver";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        level: "debug",
        layer: "api",
        action: "files.root.get",
        requestId,
      },
      async () => {
        const data = await getFilesRootInfo();
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
    logServerAction({
      level: "error",
      layer: "api",
      action: "files.root.get.response",
      status: "error",
      requestId,
      message: "Unable to read files root info",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to read files root info",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
