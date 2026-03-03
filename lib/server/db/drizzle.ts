import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { pgPool } from "@/lib/server/db/postgres";
import * as schema from "@/lib/server/db/schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __homeioDb: DrizzleDb | undefined;
}

export const db: DrizzleDb =
  globalThis.__homeioDb ?? drizzle(pgPool, { schema });

if (process.env.NODE_ENV !== "production") {
  globalThis.__homeioDb = db;
}
