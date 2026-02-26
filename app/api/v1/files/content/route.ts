import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  FileServiceError,
  readFileForViewer,
  writeTextFile,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";

const writeSchema = z.object({
  path: z.string().trim().min(1),
  content: z.string(),
  expectedMtimeMs: z.number().finite().optional(),
});

export async function GET(request: NextRequest) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.content.get",
        requestId,
      },
      async () => {
        const filePath = request.nextUrl.searchParams.get("path");
        if (!filePath) {
          return NextResponse.json(
            {
              error: "Missing file path",
              code: "invalid_path",
            },
            { status: 400 },
          );
        }

        const data = await readFileForViewer({
          path: filePath,
        });

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
    if (error instanceof FileServiceError) {
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
      action: "files.content.get.response",
      status: "error",
      requestId,
      message: "Unable to read file",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to read file",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PUT(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.content.put",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const parsed = writeSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid write payload",
              code: "invalid_path",
            },
            { status: 400 },
          );
        }

        const data = await writeTextFile(parsed.data);
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
    if (error instanceof FileServiceError) {
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
      action: "files.content.put.response",
      status: "error",
      requestId,
      message: "Unable to save file",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to save file",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
