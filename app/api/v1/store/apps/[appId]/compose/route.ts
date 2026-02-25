import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { findStoreCatalogTemplateByAppId } from "@/lib/server/modules/store/catalog";
import { fetchAndParseCompose } from "@/lib/server/modules/docker/compose-parser";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

/**
 * GET /api/v1/store/apps/[appId]/compose
 *
 * Fetches and parses the docker-compose.yml for an app from its GitHub repository.
 * This is used to pre-fill the app settings dialog with default values.
 */
export async function GET(_request: Request, context: RouteContext) {
  const requestId = createRequestId();
  const { appId } = await context.params;

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.app.compose.get",
        requestId,
        meta: { appId },
      },
      async () => {
        // Find the template
        const template = await findStoreCatalogTemplateByAppId(appId);

        if (!template) {
          return NextResponse.json(
            {
              error: "App not found",
              code: "not_found",
            },
            { status: 404 },
          );
        }

        // Fetch and parse the compose file
        const parsed = await fetchAndParseCompose({
          repositoryUrl: template.repositoryUrl,
          stackFile: template.stackFile,
          appId: template.appId,
        });

        if (!parsed) {
          return NextResponse.json(
            {
              error: "Failed to fetch or parse docker-compose.yml",
              code: "parse_error",
            },
            { status: 500 },
          );
        }

        return NextResponse.json({
          data: parsed,
        });
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "store.app.compose.get.response",
      status: "error",
      requestId,
      message: "Failed to get compose file",
      error,
    });

    return NextResponse.json(
      {
        error: "Failed to get compose file",
        code: "internal_error",
      },
      {
        status: 500,
      },
    );
  }
}
