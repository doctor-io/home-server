import "server-only";

import { Pool } from "pg";
import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";

declare global {
  var __homeioPgPool: Pool | undefined;
  var __homeioPgPoolErrorListenerAttached: boolean | undefined;
  var __homeioPgPoolInitLogged: boolean | undefined;
}

export const pgPool =
  globalThis.__homeioPgPool ??
  new Pool({
    connectionString: serverEnv.DATABASE_URL,
    max: serverEnv.PG_MAX_CONNECTIONS,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 2_000,
  });

if (serverEnv.NODE_ENV !== "production") {
  globalThis.__homeioPgPool = pgPool;
}

if (!globalThis.__homeioPgPoolErrorListenerAttached) {
  pgPool.on("error", (error) => {
    logServerAction({
      level: "error",
      layer: "db",
      action: "pg.pool.error",
      status: "error",
      error,
    });
  });
  globalThis.__homeioPgPoolErrorListenerAttached = true;
}

if (!globalThis.__homeioPgPoolInitLogged) {
  logServerAction({
    level: "info",
    layer: "db",
    action: "pg.pool.init",
    status: "success",
    meta: {
      maxConnections: serverEnv.PG_MAX_CONNECTIONS,
    },
  });
  globalThis.__homeioPgPoolInitLogged = true;
}
