import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { parseEnvFileContent } from "@/lib/shared/env-file";

const MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  for (const envFile of [".env.local", ".env"]) {
    const envPath = join(process.cwd(), envFile);
    if (!existsSync(envPath)) continue;
    const env = parseEnvFileContent(readFileSync(envPath, "utf8"));
    if (env.DATABASE_URL) return env.DATABASE_URL;
  }

  return "postgresql://postgres:postgres@127.0.0.1:5432/home_server";
}

async function run() {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const db = drizzle(pool);

  // Reset migration tracking so every migration reruns from scratch.
  // All SQL files use IF NOT EXISTS / DO $$ EXCEPTION blocks, so rerunning
  // is always safe — existing tables and data are never touched.
  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`DROP TABLE IF EXISTS drizzle.__drizzle_migrations`);

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  await pool.end();
  console.log("[db] Migrations applied successfully.");
}

run().catch((err) => {
  console.error("[db] Migration failed:", err);
  process.exit(1);
});
