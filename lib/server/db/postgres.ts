import "server-only";

import { Pool } from "pg";
import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";

declare global {
  var __homeioPgPool: Pool | undefined;
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

pgPool.on("error", (error) => {
  logServerAction({
    level: "error",
    layer: "db",
    action: "pg.pool.error",
    status: "error",
    error,
  });
});

logServerAction({
  level: "info",
  layer: "db",
  action: "pg.pool.init",
  status: "success",
  meta: {
    maxConnections: serverEnv.PG_MAX_CONNECTIONS,
  },
});
