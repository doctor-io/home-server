import "server-only";

import path from "node:path";
import { LruCache } from "@/lib/server/cache/lru";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { listInstalledAppsFromDb } from "@/lib/server/modules/apps/repository";
import { getComposeStatus } from "@/lib/server/modules/store/compose-runner";
import type { InstalledApp } from "@/lib/shared/contracts/apps";

const appsCache = new LruCache<InstalledApp[]>(4, 5_000);
const DB_UNAVAILABLE_BACKOFF_MS = 60_000;
let dbUnavailableUntil = 0;

function isDatabaseUnavailableError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const nodeError = error as NodeJS.ErrnoException;
  const code = nodeError.code ?? "";

  if (code === "ECONNREFUSED") return true;
  return error.message.includes("ECONNREFUSED");
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
            const envPath = path.join(path.dirname(app.composePath), ".env");
            try {
              const status = await getComposeStatus({
                composePath: app.composePath,
                envPath,
                stackName: app.stackName,
              });
              return { ...app, status };
            } catch {
              return { ...app, status: "unknown" as const };
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
