import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { LruCache } from "@/lib/server/cache/lru";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { listInstalledAppsFromDb } from "@/lib/server/modules/apps/repository";
import { findInstalledStackByAppId } from "@/lib/server/modules/apps/stacks-repository";
import {
  extractPrimaryServiceWithName,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";
import { getComposeRuntimeInfo } from "@/lib/server/modules/docker/compose-runner";
import type { InstalledApp } from "@/lib/shared/contracts/apps";

const appsCache = new LruCache<InstalledApp[]>(4, 5_000);
const DB_UNAVAILABLE_BACKOFF_MS = 60_000;
let dbUnavailableUntil = 0;

export function invalidateInstalledAppsCache() {
  appsCache.delete("installed-apps");
  dbUnavailableUntil = 0;
}

function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const nodeError = error as NodeJS.ErrnoException;
  const code = nodeError.code ?? "";

  if (code === "ECONNREFUSED") return true;
  return error.message.includes("ECONNREFUSED");
}

function parsePortFromUrl(value: string): number | null {
  try {
    const parsed = new URL(value);
    if (!parsed.port) return null;
    const port = Number.parseInt(parsed.port, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return null;
    }
    return port;
  } catch {
    return null;
  }
}

function extractUrlPath(value: string) {
  try {
    const parsed = new URL(value);
    const fullPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return fullPath === "/" ? "" : fullPath;
  } catch {
    return "";
  }
}

function parseHostPortFromMapping(value: string): number | null {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return null;

  const [mappingPart] = trimmed.split("/");
  const segments = mappingPart.split(":").filter(Boolean);
  if (segments.length === 0) return null;

  const hostSegment = segments.length >= 2
    ? segments[segments.length - 2]
    : segments[0];
  const port = Number.parseInt(hostSegment ?? "", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return port;
}

async function inferComposePrimaryInfo(
  appId: string,
  composePath: string,
): Promise<{
  webUiPort: number | null;
  appUrlPath: string;
  appUrlRaw: string | null;
  containerName: string | null;
}> {
  try {
    const composeContent = await readFile(composePath, "utf8");
    const parsed = parseComposeFile(composeContent);
    if (!parsed) {
      return {
        webUiPort: null,
        appUrlPath: "",
        appUrlRaw: null,
        containerName: null,
      };
    }

    const primary = extractPrimaryServiceWithName(parsed, appId);
    if (!primary) {
      return {
        webUiPort: null,
        appUrlPath: "",
        appUrlRaw: null,
        containerName: null,
      };
    }

    const appUrl = primary.service.environment?.APP_URL;
    if (typeof appUrl === "string" && appUrl.trim().length > 0) {
      const fromAppUrl = parsePortFromUrl(appUrl.trim());
      if (fromAppUrl !== null) {
        return {
          webUiPort: fromAppUrl,
          appUrlPath: extractUrlPath(appUrl.trim()),
          appUrlRaw: appUrl.trim(),
          containerName: primary.service.containerName ?? null,
        };
      }
    }

    const firstPortMapping = primary.service.ports?.find(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );
    return {
      webUiPort: firstPortMapping ? parseHostPortFromMapping(firstPortMapping) : null,
      appUrlPath: "",
      appUrlRaw: typeof appUrl === "string" ? appUrl.trim() : null,
      containerName: primary.service.containerName ?? null,
    };
  } catch {
    return {
      webUiPort: null,
      appUrlPath: "",
      appUrlRaw: null,
      containerName: null,
    };
  }
}

export async function listInstalledApps(options?: { bypassCache?: boolean }) {
  return withServerTiming(
    {
      layer: "service",
      action: "apps.listInstalled",
      meta: {
        bypassCache: Boolean(options?.bypassCache),
      },
    },
    async () => {
      const now = Date.now();

      if (now < dbUnavailableUntil) {
        return [];
      }

      if (!options?.bypassCache) {
        const cached = appsCache.get("installed-apps");
        if (cached) return cached;
      }

      let apps: InstalledApp[];

      try {
        apps = await listInstalledAppsFromDb();
        dbUnavailableUntil = 0;

        // Get real Docker status for each app
        const appsWithStatus = await Promise.all(
          apps.map(async (app) => {
            const composeInfo = await inferComposePrimaryInfo(app.id, app.composePath);
            const inferredWebUiPort = app.webUiPort ?? composeInfo.webUiPort;
            const envPath = path.join(path.dirname(app.composePath), ".env");
            try {
              const runtime = await getComposeRuntimeInfo({
                composePath: app.composePath,
                envPath,
                stackName: app.stackName,
              });
              return {
                ...app,
                webUiPort: inferredWebUiPort,
                status: runtime.status,
                containerName: runtime.primaryContainerName ?? composeInfo.containerName,
              };
            } catch {
              return {
                ...app,
                webUiPort: inferredWebUiPort,
                status: "unknown" as const,
                containerName: composeInfo.containerName,
              };
            }
          }),
        );

        apps = appsWithStatus;
      } catch (error) {
        if (!isDatabaseUnavailableError(error)) {
          throw error;
        }

        apps = [];
        dbUnavailableUntil = Date.now() + DB_UNAVAILABLE_BACKOFF_MS;
        logServerAction({
          level: "warn",
          layer: "service",
          action: "apps.listInstalled.fallback",
          status: "error",
          message: "Database unavailable; returning empty apps list",
          error,
          meta: {
            bypassCache: Boolean(options?.bypassCache),
          },
        });
      }

      appsCache.set("installed-apps", apps);
      return apps;
    },
  );
}

export async function resolveDashboardUrlForApp(appId: string): Promise<{
  url: string;
  source: "installed_stack" | "compose_app_url" | "compose_port_mapping";
  warnings: string[];
}> {
  const installed = await findInstalledStackByAppId(appId);
  if (!installed || installed.status === "not_installed") {
    throw new Error("App is not installed");
  }

  const warnings: string[] = [];
  const composeInfo = await inferComposePrimaryInfo(appId, installed.composePath);
  const envPath = path.join(path.dirname(installed.composePath), ".env");

  let runtimePath = composeInfo.appUrlPath;
  try {
    const runtime = await getComposeRuntimeInfo({
      composePath: installed.composePath,
      envPath,
      stackName: installed.stackName,
    });
    if (!runtime.primaryContainerName) {
      warnings.push("runtime_container_missing");
    }
  } catch {
    warnings.push("runtime_unavailable");
  }

  if (typeof installed.webUiPort === "number" && installed.webUiPort > 0) {
    return {
      url: `http://localhost:${installed.webUiPort}${runtimePath}`,
      source: "installed_stack",
      warnings,
    };
  }

  if (composeInfo.appUrlRaw && composeInfo.appUrlRaw.length > 0) {
    return {
      url: composeInfo.appUrlRaw,
      source: "compose_app_url",
      warnings,
    };
  }

  if (typeof composeInfo.webUiPort === "number" && composeInfo.webUiPort > 0) {
    runtimePath = runtimePath || "";
    return {
      url: `http://localhost:${composeInfo.webUiPort}${runtimePath}`,
      source: "compose_port_mapping",
      warnings,
    };
  }

  throw new Error("Dashboard URL could not be resolved");
}
