import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  for (const envFile of [".env.local", ".env"]) {
    const envPath = join(process.cwd(), envFile);
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const sep = trimmed.indexOf("=");
      if (sep <= 0) continue;
      if (trimmed.slice(0, sep).trim() !== "DATABASE_URL") continue;
      const val = trimmed.slice(sep + 1).trim().replace(/^["']|["']$/g, "");
      if (val) return val;
    }
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
