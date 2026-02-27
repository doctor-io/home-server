import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { filesLocalShares } from "@/lib/server/db/schema";

export type LocalShareRecord = {
  id: string;
  shareName: string;
  sourcePath: string;
  sharedPath: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertLocalShareInput = {
  id: string;
  shareName: string;
  sourcePath: string;
  sharedPath: string;
};

let ensureLocalSharesTablePromise: Promise<void> | null = null;

async function ensureLocalSharesTable() {
  if (!ensureLocalSharesTablePromise) {
    ensureLocalSharesTablePromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS files_local_shares (
          id text PRIMARY KEY,
          share_name text NOT NULL,
          source_path text NOT NULL,
          shared_path text NOT NULL,
          created_at timestamptz NOT NULL DEFAULT NOW(),
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS files_local_shares_share_name_idx
        ON files_local_shares (share_name)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS files_local_shares_source_path_idx
        ON files_local_shares (source_path)
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS files_local_shares_shared_path_idx
        ON files_local_shares (shared_path)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS files_local_shares_created_at_idx
        ON files_local_shares (created_at)
      `);
    })().catch((error) => {
      ensureLocalSharesTablePromise = null;
      throw error;
    });
  }

  await ensureLocalSharesTablePromise;
}

function toRecord(row: {
  id: string;
  shareName: string;
  sourcePath: string;
  sharedPath: string;
  createdAt: Date;
  updatedAt: Date;
}): LocalShareRecord {
  return {
    id: row.id,
    shareName: row.shareName,
    sourcePath: row.sourcePath,
    sharedPath: row.sharedPath,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listLocalSharesFromDb() {
  await ensureLocalSharesTable();

  const rows = await db
    .select({
      id: filesLocalShares.id,
      shareName: filesLocalShares.shareName,
      sourcePath: filesLocalShares.sourcePath,
      sharedPath: filesLocalShares.sharedPath,
      createdAt: filesLocalShares.createdAt,
      updatedAt: filesLocalShares.updatedAt,
    })
    .from(filesLocalShares)
    .orderBy(asc(filesLocalShares.createdAt));

  return rows.map(toRecord);
}

export async function getLocalShareFromDb(id: string) {
  await ensureLocalSharesTable();

  const rows = await db
    .select({
      id: filesLocalShares.id,
      shareName: filesLocalShares.shareName,
      sourcePath: filesLocalShares.sourcePath,
      sharedPath: filesLocalShares.sharedPath,
      createdAt: filesLocalShares.createdAt,
      updatedAt: filesLocalShares.updatedAt,
    })
    .from(filesLocalShares)
    .where(eq(filesLocalShares.id, id))
    .limit(1);

  return rows[0] ? toRecord(rows[0]) : null;
}

export async function getLocalShareBySourcePathFromDb(sourcePath: string) {
  await ensureLocalSharesTable();

  const rows = await db
    .select({
      id: filesLocalShares.id,
      shareName: filesLocalShares.shareName,
      sourcePath: filesLocalShares.sourcePath,
      sharedPath: filesLocalShares.sharedPath,
      createdAt: filesLocalShares.createdAt,
      updatedAt: filesLocalShares.updatedAt,
    })
    .from(filesLocalShares)
    .where(eq(filesLocalShares.sourcePath, sourcePath))
    .limit(1);

  return rows[0] ? toRecord(rows[0]) : null;
}

export async function getLocalShareByShareNameFromDb(shareName: string) {
  await ensureLocalSharesTable();

  const rows = await db
    .select({
      id: filesLocalShares.id,
      shareName: filesLocalShares.shareName,
      sourcePath: filesLocalShares.sourcePath,
      sharedPath: filesLocalShares.sharedPath,
      createdAt: filesLocalShares.createdAt,
      updatedAt: filesLocalShares.updatedAt,
    })
    .from(filesLocalShares)
    .where(eq(filesLocalShares.shareName, shareName))
    .limit(1);

  return rows[0] ? toRecord(rows[0]) : null;
}

export async function insertLocalShareInDb(input: InsertLocalShareInput) {
  await ensureLocalSharesTable();

  const rows = await db
    .insert(filesLocalShares)
    .values({
      id: input.id,
      shareName: input.shareName,
      sourcePath: input.sourcePath,
      sharedPath: input.sharedPath,
    })
    .returning({
      id: filesLocalShares.id,
      shareName: filesLocalShares.shareName,
      sourcePath: filesLocalShares.sourcePath,
      sharedPath: filesLocalShares.sharedPath,
      createdAt: filesLocalShares.createdAt,
      updatedAt: filesLocalShares.updatedAt,
    });

  if (!rows[0]) {
    throw new Error("Failed to create local share");
  }

  return toRecord(rows[0]);
}

export async function deleteLocalShareFromDb(id: string) {
  await ensureLocalSharesTable();

  const rows = await db
    .delete(filesLocalShares)
    .where(eq(filesLocalShares.id, id))
    .returning({
      id: filesLocalShares.id,
      shareName: filesLocalShares.shareName,
      sourcePath: filesLocalShares.sourcePath,
      sharedPath: filesLocalShares.sharedPath,
      createdAt: filesLocalShares.createdAt,
      updatedAt: filesLocalShares.updatedAt,
    });

  return rows[0] ? toRecord(rows[0]) : null;
}
