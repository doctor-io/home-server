import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");
const JOURNAL_PATH = join(MIGRATIONS_FOLDER, "meta/_journal.json");

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

async function markMigrationApplied(pool: Pool, hash: string, millis: number) {
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

  await pool.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at BIGINT
    )
  `);

  // Detect push-based installs (no migration tracking). When app_stacks exists
  // but the migrations table is empty, we pre-mark only migration 0000 — the
  // one that created the core tables. Migrations 0001+ use IF NOT EXISTS and
  // can safely re-run, so we let migrate() apply them normally.
  const { rows: existingTables } = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'app_stacks'
  `);

  if (existingTables.length > 0) {
    const { rows: trackedMigrations } = await pool.query(
      `SELECT COUNT(*) AS count FROM drizzle.__drizzle_migrations`,
    );
    const alreadyTracked = parseInt(trackedMigrations[0].count, 10) > 0;

    if (!alreadyTracked) {
      // Pre-mark only the first migration (0000) so migrate() skips re-creating
      // existing tables. Subsequent migrations use IF NOT EXISTS and run safely.
      const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
      const firstEntry = journal.entries[0];
      if (firstEntry) {
        const filePath = join(MIGRATIONS_FOLDER, `${firstEntry.tag}.sql`);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, "utf8");
          const hash = createHash("sha256").update(content).digest("hex");
          await markMigrationApplied(pool, hash, firstEntry.when);
          console.log("[db] Detected push-based install — pre-marked initial migration.");
        }
      }
    }
  }

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  await pool.end();
  console.log("[db] Migrations applied successfully.");
}

run().catch((err) => {
  console.error("[db] Migration failed:", err);
  process.exit(1);
});
