import { NextResponse } from "next/server";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { findCustomStoreTemplateByAppId } from "@/lib/server/modules/store/custom-apps";

export const runtime = "nodejs";

type Context = { params: Promise<{ appId: string }> };

/** Hands back the stored compose file so an app can be exported or inspected. */
export async function GET(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    const template = await findCustomStoreTemplateByAppId(appId);
    if (!template) {
      return NextResponse.json({ error: "App not found", code: "not_found" }, { status: 404 });
    }

    return new NextResponse(template.composeContent, {
      status: 200,
      headers: {
        "content-type": "application/yaml; charset=utf-8",
        "content-disposition": `attachment; filename="${appId}.docker-compose.yml"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.customApps.compose.get",
      status: "error",
      requestId,
      message: "Failed to read a custom app compose file",
      error,
    });

    return NextResponse.json(
      { error: "Failed to read that compose file", code: "internal_error" },
      { status: 500 },
    );
  }
}
