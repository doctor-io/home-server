import "server-only";

import {
  accumulateRestart,
  isCrash,
  type ContainerEvent,
  type RestartWindow,
} from "@/lib/server/modules/apps/health-watchdog";
import type { AppHealth, RestartPolicy } from "@/lib/shared/contracts/app-health";

export type HealDecision =
  | { action: "none"; reason: string }
  | { action: "restart"; delayMs: number; window: RestartWindow }
  | { action: "stop_and_notify"; reason: string; window: RestartWindow };

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/** Doubles per crash in the window, with a ceiling so it never wanders off. */
export function backoffFor(restartCount: number): number {
  const exponent = Math.max(0, restartCount - 1);
  return Math.min(BASE_BACKOFF_MS * 2 ** exponent, MAX_BACKOFF_MS);
}

function policyWantsRestart(policy: RestartPolicy, event: ContainerEvent): boolean {
  switch (policy) {
    case "always":
    case "unless-stopped":
      // Deliberate stops never reach here — isCrash filters them out first, so
      // both policies mean the same thing at this point.
      return true;
    case "on-failure":
      return (event.exitCode ?? 0) !== 0;
    case "no":
    default:
      return false;
  }
}

/**
 * Decides what to do about one container event. Pure: every input is passed in,
 * so the order of the guards is testable and obvious.
 */
export function decideHealAction(input: {
  event: ContainerEvent;
  health: AppHealth;
  window: RestartWindow;
  now: Date;
  operationInFlight: boolean;
  enabled: boolean;
}): HealDecision {
  const { event, health, window, now } = input;

  if (!input.enabled) {
    return { action: "none", reason: "auto-heal is disabled" };
  }

  // Ahead of every other check: an install, update or uninstall owns the app,
  // and restarting a container underneath one corrupts the stack.
  if (input.operationInFlight) {
    return { action: "none", reason: "an operation is already running for this app" };
  }

  if (health.mutedUntil && new Date(health.mutedUntil).getTime() > now.getTime()) {
    return { action: "none", reason: "muted" };
  }

  if (!isCrash(event)) {
    return { action: "none", reason: "not an unexpected exit" };
  }

  if (!policyWantsRestart(health.policy, event)) {
    return { action: "none", reason: `policy is "${health.policy}"` };
  }

  const { window: nextWindow, budgetSpent } = accumulateRestart(
    window,
    now,
    health.windowMinutes,
    health.maxRestarts,
  );

  if (budgetSpent) {
    return {
      action: "stop_and_notify",
      reason: `restarted ${health.maxRestarts} times in ${health.windowMinutes} minutes`,
      window: nextWindow,
    };
  }

  return { action: "restart", delayMs: backoffFor(nextWindow.count), window: nextWindow };
}
