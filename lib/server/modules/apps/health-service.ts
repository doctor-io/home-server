import "server-only";

import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";
import { listInstalledStacksFromDb } from "@/lib/server/modules/apps/stacks-repository";
import { hasActiveOperation } from "@/lib/server/modules/apps/operations";
import {
  defaultHealth,
  findAppHealth,
  recordAppHealthState,
} from "@/lib/server/modules/apps/health-repository";
import { createHealthRunner } from "@/lib/server/modules/apps/health-runner";
import {
  startHealthWatchdog,
  type ContainerEvent,
} from "@/lib/server/modules/apps/health-watchdog";
import { createNotification } from "@/lib/server/modules/notifications/service";
import { startAppLifecycleAction } from "@/lib/server/modules/store/service";

/**
 * Compose names a project after the stack, so an event is traced back to an app
 * through the installed stack list rather than by guessing at the container
 * name. Cached briefly because events arrive in bursts during a crash loop.
 */
function createAppIdResolver() {
  let cache: { at: number; byProject: Map<string, string> } | null = null;
  const TTL_MS = 30_000;

  return async function resolveAppId(event: ContainerEvent): Promise<string | null> {
    if (!event.project) return null;

    if (!cache || Date.now() - cache.at > TTL_MS) {
      const stacks = await listInstalledStacksFromDb();
      cache = {
        at: Date.now(),
        byProject: new Map(stacks.map((stack) => [stack.stackName, stack.appId])),
      };
    }

    return cache.byProject.get(event.project) ?? null;
  };
}

let stopWatchdog: (() => void) | null = null;

export function startAppHealthService() {
  if (stopWatchdog) return;

  if (!serverEnv.HOMEIO_AUTOHEAL) {
    logServerAction({
      level: "info",
      layer: "system",
      action: "apps.health.service.skip",
      message: "Auto-heal is disabled (HOMEIO_AUTOHEAL is not true)",
    });
    return;
  }

  const runner = createHealthRunner({
    resolveAppId: createAppIdResolver(),
    loadHealth: async (appId) => (await findAppHealth(appId)) ?? defaultHealth(appId),
    recordState: recordAppHealthState,
    restartApp: (appId) => startAppLifecycleAction({ appId, action: "restart" }),
    stopApp: (appId) => startAppLifecycleAction({ appId, action: "stop" }),
    notify: (input) => createNotification(input),
    hasActiveOperation,
    // Read per event rather than captured at startup, so flipping the flag off
    // takes effect on the next restart of the process without a rebuild.
    enabled: () => serverEnv.HOMEIO_AUTOHEAL,
  });

  const handle = startHealthWatchdog({
    onEvent: (event) => {
      void runner.handleEvent(event).catch((error: unknown) => {
        // A single bad event must never tear down the subscription.
        logServerAction({
          level: "warn",
          layer: "system",
          action: "apps.health.event",
          status: "error",
          message: "Failed to handle a container event",
          error,
        });
      });
    },
  });

  stopWatchdog = handle.stop;
}

export function stopAppHealthService() {
  stopWatchdog?.();
  stopWatchdog = null;
}
