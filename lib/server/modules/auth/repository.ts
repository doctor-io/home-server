import "server-only";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { sessions, users } from "@/lib/server/db/schema";

export type AuthUser = {
  id: string;
  username: string;
  passwordHash: string;
};

export type AuthSessionWithUser = {
  sessionId: string;
  userId: string;
  username: string;
  passwordHash: string;
  expiresAt: Date;
};

export async function findUserByUsername(username: string) {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return row satisfies AuthUser;
}

export async function hasAnyUsers() {
  const tableCheck = await db.execute<{ table_exists: string | null }>(
    sql`SELECT to_regclass('public.users') AS table_exists`,
  );
  if (!tableCheck.rows[0]?.table_exists) return false;

  const result = await db.select({ total: count() }).from(users);
  const total = result[0]?.total ?? 0;
  return total > 0;
}

export async function createUser(params: {
  id: string;
  username: string;
  passwordHash: string;
}) {
  await db.insert(users).values({
    id: params.id,
    username: params.username,
    passwordHash: params.passwordHash,
  });
}

export async function createSession(params: {
  id: string;
  userId: string;
  expiresAt: Date;
}) {
  await db.insert(sessions).values({
    id: params.id,
    userId: params.userId,
    expiresAt: params.expiresAt,
  });
}

export async function deleteSessionById(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function findSessionWithUser(sessionId: string) {
  const rows = await db
    .select({
      sessionId: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      username: users.username,
      passwordHash: users.passwordHash,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    username: row.username,
    passwordHash: row.passwordHash,
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt),
  } satisfies AuthSessionWithUser;
}
