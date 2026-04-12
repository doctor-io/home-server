import "server-only";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { LruCache } from "@/lib/server/cache/lru";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { resolveInstalledComposePath } from "@/lib/server/modules/apps/installed-compose-path";
import {
  findActiveStoreOperationsByAppIds,
  listInstalledAppsFromDb,
} from "@/lib/server/modules/apps/repository";
import {
  extractPrimaryServiceWithName,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";
import { getComposeRuntimeInfo } from "@/lib/server/modules/docker/compose-runner";
import type { InstalledApp } from "@/lib/shared/contracts/apps";
import { serverEnv } from "@/lib/server/env";

const DEMO_APPS: InstalledApp[] = [
  { id: "portainer", name: "Portainer", stackName: "portainer", composePath: "", webUiPort: 9000, containerName: "portainer", status: "running", updatedAt: new Date().toISOString() },
  { id: "jellyfin", name: "Jellyfin", stackName: "jellyfin", composePath: "", webUiPort: 8096, containerName: "jellyfin", status: "running", updatedAt: new Date().toISOString() },
  { id: "nextcloud", name: "Nextcloud", stackName: "nextcloud", composePath: "", webUiPort: 8080, containerName: "nextcloud", status: "running", updatedAt: new Date().toISOString() },
  { id: "vaultwarden", name: "Vaultwarden", stackName: "vaultwarden", composePath: "", webUiPort: 8081, containerName: "vaultwarden", status: "running", updatedAt: new Date().toISOString() },
  { id: "pihole", name: "Pi-hole", stackName: "pihole", composePath: "", webUiPort: 8082, containerName: "pihole", status: "running", updatedAt: new Date().toISOString() },
  { id: "grafana", name: "Grafana", stackName: "grafana", composePath: "", webUiPort: 3000, containerName: "grafana", status: "running", updatedAt: new Date().toISOString() },
  { id: "uptime-kuma", name: "Uptime Kuma", stackName: "uptime-kuma", composePath: "", webUiPort: 3001, containerName: "uptime-kuma", status: "running", updatedAt: new Date().toISOString() },
  { id: "immich", name: "Immich", stackName: "immich", composePath: "", webUiPort: 2283, containerName: "immich", status: "stopped", updatedAt: new Date().toISOString() },
];

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

async function inferComposePrimaryInfo(
  appId: string,
  composePath: string,
): Promise<{
  webUiPort: number | null;
  containerName: string | null;
}> {
  try {
    const composeContent = await readFile(composePath, "utf8");
    const parsed = parseComposeFile(composeContent);
    if (!parsed) {
      return {
        webUiPort: null,
        containerName: null,
      };
    }

    const primary = extractPrimaryServiceWithName(parsed, appId);
    if (!primary) {
      return {
        webUiPort: null,
        containerName: null,
      };
    }

    const appUrl = primary.service.environment?.APP_URL;
    if (typeof appUrl === "string" && appUrl.trim().length > 0) {
      const fromAppUrl = parsePortFromUrl(appUrl.trim());
      if (fromAppUrl !== null) {
        return {
          webUiPort: fromAppUrl,
          containerName: primary.service.containerName ?? null,
        };
      }
    }

    const firstPortMapping = primary.service.ports?.find(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    );
    return {
      webUiPort: firstPortMapping ? parseHostPortFromMapping(firstPortMapping) : null,
      containerName: primary.service.containerName ?? null,
    };
  } catch {
    return {
      webUiPort: null,
      containerName: null,
    };
  }
}

function mergeInstalledRuntimeState(input: {
  app: InstalledApp;
  composePath: string;
  runtimeStatus: InstalledApp["status"];
  inferredWebUiPort: number | null;
  containerName: string | null;
  activeOperation: InstalledApp["activeOperation"];
}) {
  return {
    ...input.app,
    composePath: input.composePath,
    webUiPort: input.inferredWebUiPort,
    status: input.runtimeStatus,
    containerName: input.containerName,
    activeOperation: input.activeOperation ?? null,
  } satisfies InstalledApp;
}

export async function listInstalledApps(options?: { bypassCache?: boolean }) {
  if (serverEnv.DEMO_MODE) return DEMO_APPS;

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
        const activeOperationsByAppId = await findActiveStoreOperationsByAppIds(
          apps.map((app) => app.id),
        );

        // Get real Docker status for each app
        const appsWithStatus = await Promise.all(
          apps.map(async (app) => {
            const resolvedComposePath = resolveInstalledComposePath({
              appId: app.id,
              composePath: app.composePath,
              stackName: app.stackName,
            });
            const composeInfo = await inferComposePrimaryInfo(app.id, resolvedComposePath);
            const inferredWebUiPort = app.webUiPort ?? composeInfo.webUiPort;
            const envPath = path.join(path.dirname(resolvedComposePath), ".env");
            try {
              const runtime = await getComposeRuntimeInfo({
                composePath: resolvedComposePath,
                envPath,
                stackName: app.stackName,
              });
              return mergeInstalledRuntimeState({
                app,
                composePath: resolvedComposePath,
                inferredWebUiPort,
                runtimeStatus: runtime.status,
                containerName: runtime.primaryContainerName ?? composeInfo.containerName,
                activeOperation: activeOperationsByAppId[app.id] ?? null,
              });
            } catch {
              return mergeInstalledRuntimeState({
                app,
                composePath: resolvedComposePath,
                inferredWebUiPort,
                runtimeStatus: "unknown",
                containerName: composeInfo.containerName,
                activeOperation: activeOperationsByAppId[app.id] ?? null,
              });
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
