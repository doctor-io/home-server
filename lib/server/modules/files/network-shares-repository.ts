import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { filesNetworkShares } from "@/lib/server/db/schema";

export type NetworkShareRecord = {
  id: string;
  host: string;
  share: string;
  username: string;
  mountPath: string;
  passwordCiphertext: string;
  passwordIv: string;
  passwordTag: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertNetworkShareInput = {
  id: string;
  host: string;
  share: string;
  username: string;
  mountPath: string;
  passwordCiphertext: string;
  passwordIv: string;
  passwordTag: string;
};

function toRecord(row: {
  id: string;
  host: string;
  share: string;
  username: string;
  mountPath: string;
  passwordCiphertext: string;
  passwordIv: string;
  passwordTag: string;
  createdAt: Date;
  updatedAt: Date;
}): NetworkShareRecord {
  return {
    id: row.id,
    host: row.host,
    share: row.share,
    username: row.username,
    mountPath: row.mountPath,
    passwordCiphertext: row.passwordCiphertext,
    passwordIv: row.passwordIv,
    passwordTag: row.passwordTag,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listNetworkSharesFromDb() {
  const rows = await db
    .select({
      id: filesNetworkShares.id,
      host: filesNetworkShares.host,
      share: filesNetworkShares.share,
      username: filesNetworkShares.username,
      mountPath: filesNetworkShares.mountPath,
      passwordCiphertext: filesNetworkShares.passwordCiphertext,
      passwordIv: filesNetworkShares.passwordIv,
      passwordTag: filesNetworkShares.passwordTag,
      createdAt: filesNetworkShares.createdAt,
      updatedAt: filesNetworkShares.updatedAt,
    })
    .from(filesNetworkShares)
    .orderBy(asc(filesNetworkShares.createdAt));

  return rows.map(toRecord);
}

export async function getNetworkShareFromDb(id: string) {
  const rows = await db
    .select({
      id: filesNetworkShares.id,
      host: filesNetworkShares.host,
      share: filesNetworkShares.share,
      username: filesNetworkShares.username,
      mountPath: filesNetworkShares.mountPath,
      passwordCiphertext: filesNetworkShares.passwordCiphertext,
      passwordIv: filesNetworkShares.passwordIv,
      passwordTag: filesNetworkShares.passwordTag,
      createdAt: filesNetworkShares.createdAt,
      updatedAt: filesNetworkShares.updatedAt,
    })
    .from(filesNetworkShares)
    .where(eq(filesNetworkShares.id, id))
    .limit(1);

  return rows[0] ? toRecord(rows[0]) : null;
}

export async function getNetworkShareByMountPathFromDb(mountPath: string) {
  const rows = await db
    .select({
      id: filesNetworkShares.id,
      host: filesNetworkShares.host,
      share: filesNetworkShares.share,
      username: filesNetworkShares.username,
      mountPath: filesNetworkShares.mountPath,
      passwordCiphertext: filesNetworkShares.passwordCiphertext,
      passwordIv: filesNetworkShares.passwordIv,
      passwordTag: filesNetworkShares.passwordTag,
      createdAt: filesNetworkShares.createdAt,
      updatedAt: filesNetworkShares.updatedAt,
    })
    .from(filesNetworkShares)
    .where(eq(filesNetworkShares.mountPath, mountPath))
    .limit(1);

  return rows[0] ? toRecord(rows[0]) : null;
}

export async function insertNetworkShareInDb(input: InsertNetworkShareInput) {
  const rows = await db
    .insert(filesNetworkShares)
    .values({
      id: input.id,
      host: input.host,
      share: input.share,
      username: input.username,
      mountPath: input.mountPath,
      passwordCiphertext: input.passwordCiphertext,
      passwordIv: input.passwordIv,
      passwordTag: input.passwordTag,
    })
    .returning({
      id: filesNetworkShares.id,
      host: filesNetworkShares.host,
      share: filesNetworkShares.share,
      username: filesNetworkShares.username,
      mountPath: filesNetworkShares.mountPath,
      passwordCiphertext: filesNetworkShares.passwordCiphertext,
      passwordIv: filesNetworkShares.passwordIv,
      passwordTag: filesNetworkShares.passwordTag,
      createdAt: filesNetworkShares.createdAt,
      updatedAt: filesNetworkShares.updatedAt,
    });

  if (!rows[0]) {
    throw new Error("Failed to create network share");
  }

  return toRecord(rows[0]);
}

export async function touchNetworkShareInDb(id: string) {
  const rows = await db
    .update(filesNetworkShares)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(filesNetworkShares.id, id))
    .returning({
      id: filesNetworkShares.id,
      host: filesNetworkShares.host,
      share: filesNetworkShares.share,
      username: filesNetworkShares.username,
      mountPath: filesNetworkShares.mountPath,
      passwordCiphertext: filesNetworkShares.passwordCiphertext,
      passwordIv: filesNetworkShares.passwordIv,
      passwordTag: filesNetworkShares.passwordTag,
      createdAt: filesNetworkShares.createdAt,
      updatedAt: filesNetworkShares.updatedAt,
    });

  return rows[0] ? toRecord(rows[0]) : null;
}

export async function deleteNetworkShareFromDb(id: string) {
  const rows = await db
    .delete(filesNetworkShares)
    .where(eq(filesNetworkShares.id, id))
    .returning({
      id: filesNetworkShares.id,
      host: filesNetworkShares.host,
      share: filesNetworkShares.share,
      username: filesNetworkShares.username,
      mountPath: filesNetworkShares.mountPath,
      passwordCiphertext: filesNetworkShares.passwordCiphertext,
      passwordIv: filesNetworkShares.passwordIv,
      passwordTag: filesNetworkShares.passwordTag,
      createdAt: filesNetworkShares.createdAt,
      updatedAt: filesNetworkShares.updatedAt,
    });

  return rows[0] ? toRecord(rows[0]) : null;
}
