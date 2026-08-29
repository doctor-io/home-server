import { NextResponse } from "next/server";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  ComposeImportError,
  fetchComposeFromUrl,
} from "@/lib/server/modules/store/compose-import";
import {
  checksumSource,
  findCustomStoreTemplateByAppId,
} from "@/lib/server/modules/store/custom-apps";

export const runtime = "nodejs";

type Context = { params: Promise<{ appId: string }> };

/**
 * Re-fetches a URL-sourced app and reports whether upstream has moved since it
 * was imported. Read-only on purpose: knowing an update exists and choosing to
 * take it are separate decisions, and the second one re-runs the risk gate.
 */
export async function POST(request: Request, context: Context) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    const template = await findCustomStoreTemplateByAppId(appId);
    if (!template) {
      return NextResponse.json({ error: "App not found", code: "not_found" }, { status: 404 });
    }

    if (!template.sourceUrl) {
      return NextResponse.json(
        {
          error: "This app was not imported from a URL, so there is nothing to check",
          code: "not_imported",
        },
        { status: 409 },
      );
    }

    const fetched = await fetchComposeFromUrl(template.sourceUrl);
    const upstreamChecksum = checksumSource(fetched.content);

    return NextResponse.json({
      data: {
        appId,
        sourceUrl: template.sourceUrl,
        sourceRef: template.sourceRef,
        lastImportedAt: template.lastImportedAt,
        currentChecksum: template.sourceChecksum,
        upstreamChecksum,
        // A missing stored checksum means the row predates C1; report it as
        // changed rather than claiming a match we cannot prove.
        changed: template.sourceChecksum !== upstreamChecksum,
        upstreamContent: fetched.content,
      },
    });
  } catch (error) {
    if (error instanceof ComposeImportError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }

    logServerAction({
      level: "error",
      layer: "api",
      action: "store.customApps.checkImport.post",
      status: "error",
      requestId,
      message: "Failed to check a custom app for upstream changes",
      error,
    });

    return NextResponse.json(
      { error: "Failed to check for updates", code: "internal_error" },
      { status: 500 },
    );
  }
}
