import { readFile } from "node:fs/promises";
import nodePath from "node:path";
import { NextResponse } from "next/server";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";
import { findInstalledStackByAppId } from "@/lib/server/modules/apps/stacks-repository";
import { findStoreCatalogTemplateByAppId } from "@/lib/server/modules/store/catalog";
import {
  extractPrimaryServiceWithName,
  fetchComposeFileFromGitHub,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";
import { resolveStoreStacksRoot } from "@/lib/server/storage/data-root";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

type ComposeSource = "catalog" | "installed";

function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relative = nodePath.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !nodePath.isAbsolute(relative));
}

/**
 * GET /api/v1/store/apps/[appId]/compose
 *
 * Fetches and parses the docker-compose.yml for an app from its GitHub repository.
 * This is used to pre-fill the app settings dialog with default values.
 */
export async function GET(request: Request, context: RouteContext) {
  const requestId = createRequestId();
  const { appId } = await context.params;
  const url = new URL(request.url);
  const sourceRaw = url.searchParams.get("source");
  const source: ComposeSource = sourceRaw === "installed" ? "installed" : "catalog";

  try {
    return await withServerTiming(
      {
        layer: "api",
        action: "store.app.compose.get",
        requestId,
        meta: { appId, source },
      },
      async () => {
        if (sourceRaw && sourceRaw !== "catalog" && sourceRaw !== "installed") {
          return NextResponse.json(
            {
              error: "Invalid compose source",
              code: "invalid_source",
            },
            { status: 400 },
          );
        }

        let compose = "";
        let primaryAppId = appId;

        if (source === "catalog") {
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

          const fetchedCompose = await fetchComposeFileFromGitHub({
            repositoryUrl: template.repositoryUrl,
            stackFile: template.stackFile,
          });
          if (!fetchedCompose) {
            return NextResponse.json(
              {
                error: "Failed to fetch or parse docker-compose.yml",
                code: "parse_error",
              },
              { status: 500 },
            );
          }

          compose = fetchedCompose;
          primaryAppId = template.appId;
        } else {
          const installed = await findInstalledStackByAppId(appId);
          if (!installed || !installed.composePath) {
            return NextResponse.json(
              {
                error: "Installed compose file not found",
                code: "installed_compose_missing",
              },
              { status: 404 },
            );
          }

          const stacksRoot = nodePath.resolve(resolveStoreStacksRoot());
          const composePath = nodePath.resolve(installed.composePath);
          if (!isPathWithinRoot(composePath, stacksRoot)) {
            return NextResponse.json(
              {
                error: "Installed compose file not found",
                code: "installed_compose_missing",
              },
              { status: 404 },
            );
          }

          try {
            compose = await readFile(composePath, "utf8");
          } catch {
            return NextResponse.json(
              {
                error: "Installed compose file not found",
                code: "installed_compose_missing",
              },
              { status: 404 },
            );
          }
          primaryAppId = installed.appId;
        }

        const parsedFile = parseComposeFile(compose);
        const primary = parsedFile
          ? extractPrimaryServiceWithName(parsedFile, primaryAppId)
          : null;

        if (!primary) {
          return NextResponse.json(
            {
              error: "Failed to fetch or parse docker-compose.yml",
              code: "parse_error",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          {
            data: {
              compose,
              primary: primary.service,
              primaryServiceName: primary.name,
            },
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
      action: "store.app.compose.get.response",
      status: "error",
      requestId,
      message: "Failed to get compose file",
      error,
      meta: {
        appId,
        source,
      },
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
