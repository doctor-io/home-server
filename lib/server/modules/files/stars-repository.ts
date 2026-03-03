import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";

type StarredPathRecord = {
  path: string;
  createdAt: Date;
};

let ensureStarsTablePromise: Promise<void> | null = null;

async function ensureStarsTable() {
  if (!ensureStarsTablePromise) {
    ensureStarsTablePromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS files_starred_paths (
          path text PRIMARY KEY,
          created_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS files_starred_paths_created_at_idx
        ON files_starred_paths (created_at DESC)
      `);
    })().catch((error) => {
      ensureStarsTablePromise = null;
      throw error;
    });
  }
  await ensureStarsTablePromise;
}

export async function listStarredPathsFromDb() {
  await ensureStarsTable();
  const result = await db.execute<StarredPathRecord>(sql`
    SELECT path, created_at AS "createdAt"
    FROM files_starred_paths
    ORDER BY created_at DESC
  `);
  return result.rows.map((row) => row.path);
}

export async function isPathStarredInDb(pathValue: string) {
  await ensureStarsTable();
  const result = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS(
      SELECT 1 FROM files_starred_paths WHERE path = ${pathValue}
    ) AS exists
  `);
  return Boolean(result.rows[0]?.exists);
}

export async function setPathStarredInDb(pathValue: string, starred: boolean) {
  await ensureStarsTable();

  if (starred) {
    await db.execute(sql`
      INSERT INTO files_starred_paths (path)
      VALUES (${pathValue})
      ON CONFLICT (path) DO NOTHING
    `);
    return;
  }

  await db.execute(sql`
    DELETE FROM files_starred_paths WHERE path = ${pathValue}
  `);
}

