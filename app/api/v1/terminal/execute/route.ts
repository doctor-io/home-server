import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  executeTerminalCommand,
  TerminalServiceError,
} from "@/lib/server/modules/terminal/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "terminal.execute.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const data = await executeTerminalCommand(payload, {
          requestId,
        });

        return NextResponse.json({
          data,
        });
      },
    );
  } catch (error) {
    if (error instanceof TerminalServiceError) {
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
      action: "terminal.execute.post.response",
      status: "error",
      requestId,
      message: "Unable to execute terminal command",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to execute terminal command",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
