import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { appHealth } from "@/lib/server/db/schema";
import {
  APP_HEALTH_DEFAULTS,
  isRestartPolicy,
  type AppHealth,
  type AppHealthState,
  type AppHealthUpdate,
} from "@/lib/shared/contracts/app-health";

const HEALTH_STATES: AppHealthState[] = [
  "unknown",
  "healthy",
  "restarting",
  "unhealthy",
  "stopped_by_policy",
];

type Row = typeof appHealth.$inferSelect;

function toHealth(row: Row): AppHealth {
  return {
    appId: row.appId,
    // An unrecognised policy falls back to "no" rather than being trusted:
    // the safe reading of a corrupt row is "do not touch this container".
    policy: isRestartPolicy(row.restartPolicy) ? row.restartPolicy : APP_HEALTH_DEFAULTS.policy,
    maxRestarts: row.maxRestarts,
    windowMinutes: row.windowMinutes,
    state: HEALTH_STATES.includes(row.state as AppHealthState)
      ? (row.state as AppHealthState)
      : "unknown",
    restartCount: row.restartCount,
    windowStartedAt: row.windowStartedAt?.toISOString() ?? null,
    lastTransitionAt: row.lastTransitionAt?.toISOString() ?? null,
    mutedUntil: row.mutedUntil?.toISOString() ?? null,
  };
}

/** Apps with no row have never been configured, which is the same as policy "no". */
export function defaultHealth(appId: string): AppHealth {
  return {
    appId,
    policy: APP_HEALTH_DEFAULTS.policy,
    maxRestarts: APP_HEALTH_DEFAULTS.maxRestarts,
    windowMinutes: APP_HEALTH_DEFAULTS.windowMinutes,
    state: "unknown",
    restartCount: 0,
    windowStartedAt: null,
    lastTransitionAt: null,
    mutedUntil: null,
  };
}

export async function findAppHealth(appId: string): Promise<AppHealth | null> {
  const rows = await db.select().from(appHealth).where(eq(appHealth.appId, appId)).limit(1);
  const row = rows[0];
  return row ? toHealth(row) : null;
}

export async function listAppHealth(): Promise<AppHealth[]> {
  const rows = await db.select().from(appHealth);
  return rows.map(toHealth);
}

export async function saveAppHealthPolicy(
  appId: string,
  update: AppHealthUpdate,
): Promise<void> {
  const policy = update.policy ?? APP_HEALTH_DEFAULTS.policy;
  const maxRestarts = update.maxRestarts ?? APP_HEALTH_DEFAULTS.maxRestarts;
  const windowMinutes = update.windowMinutes ?? APP_HEALTH_DEFAULTS.windowMinutes;
  const mutedUntil = update.mutedUntil ? new Date(update.mutedUntil) : null;

  await db
    .insert(appHealth)
    .values({ appId, restartPolicy: policy, maxRestarts, windowMinutes, mutedUntil })
    .onConflictDoUpdate({
      target: appHealth.appId,
      set: {
        restartPolicy: policy,
        maxRestarts,
        windowMinutes,
        mutedUntil,
        updatedAt: sql`NOW()`,
      },
    });
}

/**
 * Records what the watchdog observed. Kept separate from the policy write so a
 * user editing settings never clobbers live counters, and vice versa.
 */
export async function recordAppHealthState(input: {
  appId: string;
  state: AppHealthState;
  restartCount?: number;
  windowStartedAt?: Date | null;
}): Promise<void> {
  await db
    .insert(appHealth)
    .values({
      appId: input.appId,
      state: input.state,
      restartCount: input.restartCount ?? 0,
      windowStartedAt: input.windowStartedAt ?? null,
      lastTransitionAt: new Date(),
    })
    .onConflictDoUpdate({
      target: appHealth.appId,
      set: {
        state: input.state,
        ...(input.restartCount === undefined ? {} : { restartCount: input.restartCount }),
        ...(input.windowStartedAt === undefined
          ? {}
          : { windowStartedAt: input.windowStartedAt }),
        lastTransitionAt: sql`NOW()`,
        updatedAt: sql`NOW()`,
      },
    });
}

export async function deleteAppHealth(appId: string): Promise<void> {
  await db.delete(appHealth).where(eq(appHealth.appId, appId));
}
