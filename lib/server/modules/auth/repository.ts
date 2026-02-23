import "server-only";

import { timedPgQuery } from "@/lib/server/db/query";

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  created_at: string | Date;
};

type SessionWithUserRow = {
  session_id: string;
  user_id: string;
  username: string;
  password_hash: string;
  expires_at: string | Date;
};

type CountRow = {
  total: string | number;
};

type ExistsRow = {
  exists: boolean;
};

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
  const result = await timedPgQuery<UserRow>(
    "SELECT id, username, password_hash, created_at FROM users WHERE username = $1 LIMIT 1",
    [username],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
  } satisfies AuthUser;
}

export async function hasAnyUsers() {
  const existsResult = await timedPgQuery<ExistsRow>(
    "SELECT to_regclass('public.users') IS NOT NULL AS exists",
  );
  const tableExists = existsResult.rows[0]?.exists ?? false;
  if (!tableExists) return false;

  const result = await timedPgQuery<CountRow>("SELECT COUNT(*)::int AS total FROM users");
  const row = result.rows[0];
  if (!row) return false;

  const count =
    typeof row.total === "number" ? row.total : Number.parseInt(row.total, 10);

  return Number.isFinite(count) && count > 0;
}

export async function createUser(params: {
  id: string;
  username: string;
  passwordHash: string;
}) {
  await timedPgQuery(
    "INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)",
    [params.id, params.username, params.passwordHash],
  );
}

export async function createSession(params: {
  id: string;
  userId: string;
  expiresAt: Date;
}) {
  await timedPgQuery(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
    [params.id, params.userId, params.expiresAt.toISOString()],
  );
}

export async function deleteSessionById(sessionId: string) {
  await timedPgQuery("DELETE FROM sessions WHERE id = $1", [sessionId]);
}

export async function findSessionWithUser(sessionId: string) {
  const result = await timedPgQuery<SessionWithUserRow>(
    `SELECT
      s.id AS session_id,
      s.user_id AS user_id,
      s.expires_at AS expires_at,
      u.username AS username,
      u.password_hash AS password_hash
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > NOW()
    LIMIT 1`,
    [sessionId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    username: row.username,
    passwordHash: row.password_hash,
    expiresAt:
      typeof row.expires_at === "string"
        ? new Date(row.expires_at)
        : row.expires_at,
  } satisfies AuthSessionWithUser;
}
