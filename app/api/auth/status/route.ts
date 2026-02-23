import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { hasAnyUsers } from "@/lib/server/modules/auth/repository";

export const runtime = "nodejs";

export async function GET() {
  const requestId = createRequestId();

  try {
    const hasUsers = await withServerTiming(
      {
        layer: "api",
        action: "auth.status",
        requestId,
      },
      () => hasAnyUsers(),
    );

    return NextResponse.json({
      data: {
        hasUsers,
      },
    });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.status",
      status: "error",
      requestId,
      error,
    });

    return NextResponse.json(
      {
        error: "Failed to read auth status",
      },
      { status: 500 },
    );
  }
}
