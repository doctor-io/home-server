import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/server/env";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import {
  createDirectoryEntry,
  createFileEntry,
  FileServiceError,
  getEntryInfo,
  pasteEntry,
  renameEntry,
  toggleStarEntry,
} from "@/lib/server/modules/files/service";

export const runtime = "nodejs";

const opsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_folder"),
    parentPath: z.string().trim().default(""),
    name: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("create_file"),
    parentPath: z.string().trim().default(""),
    name: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("paste"),
    sourcePath: z.string().trim().min(1),
    destinationPath: z.string().trim().default(""),
    operation: z.enum(["copy", "move"]),
  }),
  z.object({
    action: z.literal("rename"),
    path: z.string().trim().min(1),
    newName: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("get_info"),
    path: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("toggle_star"),
    path: z.string().trim().min(1),
  }),
]);

export async function POST(request: Request) {
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "files.ops.post",
        requestId,
      },
      async () => {
        const payload = await request.json();
        const parsed = opsSchema.safeParse(payload);
        if (!parsed.success) {
          return NextResponse.json(
            {
              error: "Invalid files operation payload",
              code: "invalid_path",
            },
            { status: 400 },
          );
        }

        const includeHidden = serverEnv.FILES_ALLOW_HIDDEN;
        if (parsed.data.action === "create_folder") {
          const data = await createDirectoryEntry({
            parentPath: parsed.data.parentPath,
            name: parsed.data.name,
            includeHidden,
          });
          return NextResponse.json(
            { data },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }

        if (parsed.data.action === "create_file") {
          const data = await createFileEntry({
            parentPath: parsed.data.parentPath,
            name: parsed.data.name,
            includeHidden,
          });
          return NextResponse.json(
            { data },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }

        if (parsed.data.action === "rename") {
          const data = await renameEntry({
            path: parsed.data.path,
            newName: parsed.data.newName,
            includeHidden,
          });
          return NextResponse.json(
            { data },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }

        if (parsed.data.action === "get_info") {
          const data = await getEntryInfo({
            path: parsed.data.path,
            includeHidden,
          });
          return NextResponse.json(
            { data },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }

        if (parsed.data.action === "toggle_star") {
          const data = await toggleStarEntry({
            path: parsed.data.path,
            includeHidden,
          });
          return NextResponse.json(
            { data },
            {
              headers: {
                "Cache-Control": "no-store",
              },
            },
          );
        }

        const data = await pasteEntry({
          sourcePath: parsed.data.sourcePath,
          destinationPath: parsed.data.destinationPath,
          operation: parsed.data.operation,
          includeHidden,
        });
        return NextResponse.json(
          { data },
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
      action: "files.ops.post.response",
      status: "error",
      requestId,
      message: "Unable to execute file operation",
      error,
    });

    return NextResponse.json(
      {
        error: "Unable to execute file operation",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
