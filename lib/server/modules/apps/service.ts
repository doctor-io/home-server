import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { LruCache } from "@/lib/server/cache/lru";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { listInstalledAppsFromDb } from "@/lib/server/modules/apps/repository";
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

async function inferWebUiPortFromCompose(
  appId: string,
  composePath: string,
): Promise<number | null> {
  try {
    const composeContent = await readFile(composePath, "utf8");
    const parsed = parseComposeFile(composeContent);
    if (!parsed) return null;

    const primary = extractPrimaryServiceWithName(parsed, appId);
    if (!primary) return null;

    const appUrl = primary.service.environment?.APP_URL;
    if (typeof appUrl === "string" && appUrl.trim().length > 0) {
      const fromAppUrl = parsePortFromUrl(appUrl.trim());
      if (fromAppUrl !== null) {
        return fromAppUrl;
      }
    }

    const firstPortMapping = primary.service.ports?.find(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );
    if (!firstPortMapping) return null;
    return parseHostPortFromMapping(firstPortMapping);
  } catch {
    return null;
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
            const inferredWebUiPort =
              app.webUiPort ?? (await inferWebUiPortFromCompose(app.id, app.composePath));
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
                containerName: runtime.primaryContainerName,
              };
            } catch {
              return {
                ...app,
                webUiPort: inferredWebUiPort,
                status: "unknown" as const,
                containerName: null,
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
