import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { filesTrashEntries } from "@/lib/server/db/schema";

export type TrashEntryRecord = {
  id: string;
  trashPath: string;
  originalPath: string;
  deletedAt: Date;
};

export type UpsertTrashEntryInput = {
  id: string;
  trashPath: string;
  originalPath: string;
  deletedAt?: Date;
};

let ensureTrashEntriesTablePromise: Promise<void> | null = null;

async function ensureTrashEntriesTable() {
  if (!ensureTrashEntriesTablePromise) {
    ensureTrashEntriesTablePromise = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS files_trash_entries (
          id text PRIMARY KEY,
          trash_path text NOT NULL,
          original_path text NOT NULL,
          deleted_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS files_trash_entries_trash_path_idx
        ON files_trash_entries (trash_path)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS files_trash_entries_deleted_at_idx
        ON files_trash_entries (deleted_at DESC)
      `);
    })().catch((error) => {
      ensureTrashEntriesTablePromise = null;
      throw error;
    });
  }

  await ensureTrashEntriesTablePromise;
}

function toRecord(row: {
  id: string;
  trashPath: string;
  originalPath: string;
  deletedAt: Date;
}): TrashEntryRecord {
  return {
    id: row.id,
    trashPath: row.trashPath,
    originalPath: row.originalPath,
    deletedAt: row.deletedAt,
  };
}

export async function upsertTrashEntryInDb(input: UpsertTrashEntryInput) {
  await ensureTrashEntriesTable();

  const deletedAt = input.deletedAt ?? new Date();

  const rows = await db
    .insert(filesTrashEntries)
    .values({
      id: input.id,
      trashPath: input.trashPath,
      originalPath: input.originalPath,
      deletedAt,
    })
    .onConflictDoUpdate({
      target: filesTrashEntries.trashPath,
      set: {
        originalPath: input.originalPath,
        deletedAt,
      },
    })
    .returning({
      id: filesTrashEntries.id,
      trashPath: filesTrashEntries.trashPath,
      originalPath: filesTrashEntries.originalPath,
      deletedAt: filesTrashEntries.deletedAt,
    });

  if (!rows[0]) {
    throw new Error("Failed to upsert trash entry");
  }

  return toRecord(rows[0]);
}

export async function getTrashEntryFromDb(trashPath: string) {
  await ensureTrashEntriesTable();

  const rows = await db
    .select({
      id: filesTrashEntries.id,
      trashPath: filesTrashEntries.trashPath,
      originalPath: filesTrashEntries.originalPath,
      deletedAt: filesTrashEntries.deletedAt,
    })
    .from(filesTrashEntries)
    .where(eq(filesTrashEntries.trashPath, trashPath))
    .limit(1);

  return rows[0] ? toRecord(rows[0]) : null;
}

export async function deleteTrashEntryFromDb(trashPath: string) {
  await ensureTrashEntriesTable();

  const rows = await db
    .delete(filesTrashEntries)
    .where(eq(filesTrashEntries.trashPath, trashPath))
    .returning({
      id: filesTrashEntries.id,
      trashPath: filesTrashEntries.trashPath,
      originalPath: filesTrashEntries.originalPath,
      deletedAt: filesTrashEntries.deletedAt,
    });

  return rows[0] ? toRecord(rows[0]) : null;
}
