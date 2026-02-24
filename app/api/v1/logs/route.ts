import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  ingestClientLog,
  logServerAction,
} from "@/lib/server/logging/logger";

export const runtime = "nodejs";

const clientLogSchema = z.object({
  timestamp: z.string().min(1),
  runtime: z.literal("client").optional(),
  level: z.enum(["debug", "info", "warn", "error"]),
  layer: z.enum(["api", "db", "hook", "realtime", "service", "system"]),
  action: z.string().trim().min(1),
  status: z.enum(["start", "success", "error", "info"]),
  durationMs: z.number().finite().optional(),
  requestId: z.string().trim().min(1).optional(),
  message: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  error: z
    .object({
      name: z.string().optional(),
      message: z.string(),
      stack: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    const json = await request.json();
    const parsed = clientLogSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid client log payload",
          issues: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    ingestClientLog({
      ...parsed.data,
      runtime: "client",
    });

    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "logs.ingest.post",
      status: "error",
      requestId,
      message: "Unable to ingest client log payload",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to ingest client log payload",
      },
      { status: 500 },
    );
  }
}
