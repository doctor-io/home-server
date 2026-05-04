import { type NextRequest, NextResponse } from "next/server";
import { createDriveFolder } from "@/lib/server/modules/files/google-drive-api";
import { GoogleDriveError } from "@/lib/server/modules/files/google-drive";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().min(1).default("root"),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();
  const { id } = await context.params;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", code: "bad_request" }, { status: 400 });
  }

  try {
    const entry = await createDriveFolder(id, parsed.data.parentId, parsed.data.name);
    return NextResponse.json({ data: entry });
  } catch (error) {
    if (error instanceof GoogleDriveError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    logServerAction({
      level: "error",
      layer: "api",
      action: "files.google-drive.folders.post",
      status: "error",
      requestId,
      message: "Failed to create Drive folder",
      error,
      meta: { id },
    });
    return NextResponse.json({ error: "Failed to create folder", code: "internal_error" }, { status: 500 });
  }
}
