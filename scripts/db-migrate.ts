/**
 * Non-interactive database migration runner.
 * Handles the transition from drizzle-kit push to proper migrations.
 * Safe to run on both fresh installs and upgrades.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");
const JOURNAL_PATH = join(MIGRATIONS_FOLDER, "meta/_journal.json");

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Try reading from .env files
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

async function markMigrationApplied(
  pool: Pool,
  hash: string,
  millis: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [hash, millis],
  );
}

async function run() {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const db = drizzle(pool);

  // Ensure drizzle schema and migrations table exist (drizzle-orm migrate creates
  // these, but we need them before we can pre-mark migrations).
  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at BIGINT
    )
  `);

  // Check whether this server was previously using drizzle-kit push (no migration
  // tracking). If the app_stacks table already exists we know a push-based setup
  // was used and we need to mark old migrations as applied so migrate() won't
  // try to re-run them (which would fail with "table already exists").
  const { rows: existingTables } = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_stacks'
  `);

  if (existingTables.length > 0) {
    // Pre-mark all migrations that were applied via push so migrate() skips them.
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
    for (const entry of journal.entries) {
      const filePath = join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
      if (!existsSync(filePath)) continue;
      const content = readFileSync(filePath, "utf8");
      const hash = createHash("sha256").update(content).digest("hex");
      await markMigrationApplied(pool, hash, entry.when);
    }
  }

  // Run pending migrations (only ones not yet tracked).
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  await pool.end();
  console.log("[db] Migrations applied successfully.");
}

run().catch((err) => {
  console.error("[db] Migration failed:", err);
  process.exit(1);
});
