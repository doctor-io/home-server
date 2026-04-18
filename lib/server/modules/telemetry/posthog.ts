import "server-only";

import { PostHog } from "posthog-node";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { instanceConfig } from "@/lib/server/db/schema";
import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";

const POSTHOG_HOST = "https://eu.i.posthog.com";
// Public write-only ingest key — safe to ship in source.
const DEFAULT_API_KEY = "phc_homeio_placeholder";

function getApiKey(): string {
  return serverEnv.POSTHOG_API_KEY ?? DEFAULT_API_KEY;
}

async function resolveConfig(): Promise<{ instanceId: string; telemetryEnabled: boolean } | null> {
  try {
    const rows = await db.select().from(instanceConfig).limit(1);

    if (rows[0]) return { instanceId: rows[0].instanceId, telemetryEnabled: rows[0].telemetryEnabled };

    const newId = randomUUID();
    await db
      .insert(instanceConfig)
      .values({ id: "singleton", instanceId: newId, telemetryEnabled: true })
      .onConflictDoNothing();
    return { instanceId: newId, telemetryEnabled: true };
  } catch {
    return null;
  }
}

export async function getTelemetryEnabled(): Promise<boolean> {
  const config = await resolveConfig();
  return config?.telemetryEnabled ?? true;
}

export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  const config = await resolveConfig();
  if (!config) return;

  await db
    .update(instanceConfig)
    .set({ telemetryEnabled: enabled })
    .where(eq(instanceConfig.id, "singleton"));
}

export async function sendStartupPing(): Promise<void> {
  // Env var is the hard system-level opt-out (set at install time).
  if (!serverEnv.HOMEIO_TELEMETRY) return;
  if (serverEnv.DEMO_MODE) return;
  if (serverEnv.NODE_ENV !== "production") return;

  try {
    const config = await resolveConfig();
    if (!config?.telemetryEnabled) return;

    const client = new PostHog(getApiKey(), {
      host: POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });

    client.capture({
      distinctId: config.instanceId,
      event: "server_startup",
      properties: {
        version: process.env.npm_package_version ?? "unknown",
        node_version: process.version,
        arch: process.arch,
        platform: process.platform,
      },
    });

    await client.shutdown();
  } catch (error) {
    // Telemetry is best-effort — never crash the app.
    logServerAction({
      level: "warn",
      layer: "service",
      action: "startup_ping",
      status: "error",
      error,
    });
  }
}
