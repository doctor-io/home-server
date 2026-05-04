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
import { findCustomStoreTemplateByAppId } from "@/lib/server/modules/store/custom-apps";
import {
  extractPrimaryServiceWithName,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";
import { resolveStoreStacksRoot } from "@/lib/server/storage/data-root";
import { requireApiSession } from "@/lib/server/modules/auth/api";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ appId: string }>;
};

type ComposeSource = "catalog" | "installed";
const ENV_INTERPOLATION_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

function isPathWithinRoot(candidatePath: string, rootPath: string) {
  const relative = nodePath.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !nodePath.isAbsolute(relative));
}

function parseEnvFile(content: string) {
  const env: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    env[key] = value.replace(/^['"]|['"]$/g, "");
  }

  return env;
}

function interpolateComposeEnv(content: string, env: Record<string, string>) {
  return content.replace(ENV_INTERPOLATION_PATTERN, (_match, braced, bare) => {
    const key = typeof braced === "string" && braced.length > 0 ? braced : bare;
    return key && key in env ? env[key] ?? "" : "";
  });
}

export async function GET(request: Request, context: RouteContext) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
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
          const template =
            (await findStoreCatalogTemplateByAppId(appId)) ??
            (await findCustomStoreTemplateByAppId(appId));
          if (!template) {
            return NextResponse.json(
              {
                error: "App not found",
                code: "not_found",
              },
              { status: 404 },
            );
          }

          if ("composeContent" in template && typeof template.composeContent === "string") {
            compose = template.composeContent;
          } else {
            compose = await readFile(template.composePath, "utf8");
          }
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
          const composeEnv = {
            AppID: installed.appId,
          } satisfies Record<string, string>;
          const envPath = nodePath.join(nodePath.dirname(composePath), ".env");
          try {
            const envContent = await readFile(envPath, "utf8");
            Object.assign(composeEnv, parseEnvFile(envContent));
          } catch {
            // Keep installed AppID fallback even when no env file is present.
          }
          compose = interpolateComposeEnv(compose, composeEnv);
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
