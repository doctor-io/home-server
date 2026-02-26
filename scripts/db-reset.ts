import { drizzle } from "drizzle-orm/node-postgres";
import { reset } from "drizzle-seed";
import { Pool } from "pg";

// path to a file with schema you want to reset
import * as schema from "../lib/server/db/schema-definitions";

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/home_server";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    await reset(db, schema);
    console.log("Database reset complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database reset failed.");
  console.error(error);
  process.exitCode = 1;
});
