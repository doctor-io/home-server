import "server-only";

import { logServerAction } from "@/lib/server/logging/logger";
import { decideHealAction } from "@/lib/server/modules/apps/health-policy";
import {
  isCrash,
  stateForEvent,
  type ContainerEvent,
  type RestartWindow,
} from "@/lib/server/modules/apps/health-watchdog";
import type { AppHealth, AppHealthState } from "@/lib/shared/contracts/app-health";
import type { NotificationKind } from "@/lib/shared/contracts/notifications";

/**
 * Everything the runner touches is injected, so the decision-to-action path can
 * be tested without Docker, a database, or a clock.
 */
export type HealthRunnerDeps = {
  resolveAppId: (event: ContainerEvent) => Promise<string | null>;
  loadHealth: (appId: string) => Promise<AppHealth>;
  recordState: (input: {
    appId: string;
    state: AppHealthState;
    restartCount?: number;
    windowStartedAt?: Date | null;
  }) => Promise<void>;
  restartApp: (appId: string) => Promise<unknown>;
  stopApp: (appId: string) => Promise<unknown>;
  // Reuses the app's own notification kinds rather than inventing a parallel set.
  notify: (input: { title: string; body: string; kind?: NotificationKind }) => Promise<unknown>;
  hasActiveOperation: (appId: string) => boolean;
  enabled: () => boolean;
  now?: () => Date;
  /** Injected so tests do not wait out a real backoff. */
  schedule?: (fn: () => void, delayMs: number) => void;
};

export type HealthRunner = {
  handleEvent: (event: ContainerEvent) => Promise<void>;
  windowFor: (appId: string) => RestartWindow;
};

const EMPTY_WINDOW: RestartWindow = { count: 0, startedAt: null };

export function createHealthRunner(deps: HealthRunnerDeps): HealthRunner {
  // Restart windows live in memory, keyed by installed app. Bounded by the
  // number of apps rather than by event volume, following the v1.7 fix for the
  // operation-event map that grew forever.
  const windows = new Map<string, RestartWindow>();
  const now = deps.now ?? (() => new Date());
  const schedule =
    deps.schedule ??
    ((fn, delayMs) => {
      const timer = setTimeout(fn, delayMs);
      // A pending restart must never hold shutdown open.
      timer.unref?.();
    });

  async function handleEvent(event: ContainerEvent) {
    const appId = await deps.resolveAppId(event);
    if (!appId) return;

    const observed = stateForEvent(event);
    const health = await deps.loadHealth(appId);

    const decision = decideHealAction({
      event,
      health,
      window: windows.get(appId) ?? EMPTY_WINDOW,
      now: now(),
      operationInFlight: deps.hasActiveOperation(appId),
      enabled: deps.enabled(),
    });

    if (decision.action === "none") {
      // Still record what was seen: observation is useful even where the policy
      // says to do nothing, and it is what the UI's health dot reads.
      if (observed && isCrash(event)) {
        await deps.recordState({ appId, state: "unhealthy" });
      } else if (observed) {
        await deps.recordState({ appId, state: observed });
      }
      return;
    }

    windows.set(appId, decision.window);

    if (decision.action === "stop_and_notify") {
      await deps.recordState({
        appId,
        state: "stopped_by_policy",
        restartCount: decision.window.count,
        windowStartedAt: decision.window.startedAt,
      });

      await deps.stopApp(appId).catch((error: unknown) => {
        logServerAction({
          level: "error",
          layer: "system",
          action: "apps.health.stop",
          status: "error",
          message: `Could not stop ${appId} after repeated crashes`,
          error,
        });
      });

      await deps.notify({
        title: `${appId} keeps crashing`,
        // Say what was done and why, not just that something happened.
        body: `Homeio stopped it after it ${decision.reason}. Check its logs before starting it again.`,
        kind: "error",
      });
      return;
    }

    await deps.recordState({
      appId,
      state: "restarting",
      restartCount: decision.window.count,
      windowStartedAt: decision.window.startedAt,
    });

    schedule(() => {
      // Re-check the guard at fire time: an operation may have started during
      // the backoff, and the decision was made before the wait.
      if (!deps.enabled() || deps.hasActiveOperation(appId)) return;

      void deps.restartApp(appId).catch((error: unknown) => {
        logServerAction({
          level: "warn",
          layer: "system",
          action: "apps.health.restart",
          status: "error",
          message: `Could not restart ${appId}`,
          error,
        });
      });
    }, decision.delayMs);
  }

  return {
    handleEvent,
    windowFor: (appId) => windows.get(appId) ?? EMPTY_WINDOW,
  };
}
