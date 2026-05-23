import "server-only";

import { and, count, eq, gt } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { sessions, users } from "@/lib/server/db/schema";

export type AuthUser = {
  id: string;
  username: string;
  passwordHash: string;
};

export type AuthUserWithTotp = AuthUser & {
  totpSecret: string | null;
  totpEnabled: boolean;
  totpBackupCodes: string | null;
  totpEnrolledAt: Date | null;
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
  const result = await db.select({ total: count() }).from(users).limit(1);
  return (result[0]?.total ?? 0) > 0;
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

export async function findUserWithTotpById(
  userId: string,
): Promise<AuthUserWithTotp | null> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      totpSecret: users.totpSecret,
      totpEnabled: users.totpEnabled,
      totpBackupCodes: users.totpBackupCodes,
      totpEnrolledAt: users.totpEnrolledAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    totpSecret: row.totpSecret,
    totpEnabled: row.totpEnabled,
    totpBackupCodes: row.totpBackupCodes,
    totpEnrolledAt:
      row.totpEnrolledAt instanceof Date || row.totpEnrolledAt === null
        ? row.totpEnrolledAt
        : new Date(row.totpEnrolledAt),
  } satisfies AuthUserWithTotp;
}

/**
 * Persists a freshly-generated (but not yet confirmed) TOTP secret on the
 * user row. Leaves `totp_enabled` untouched — the user must complete
 * verification before that flips to true.
 */
export async function setPendingTotpSecret(
  userId: string,
  encryptedSecret: string,
) {
  await db
    .update(users)
    .set({ totpSecret: encryptedSecret })
    .where(eq(users.id, userId));
}

/**
 * Flips the user from "secret stored, awaiting first valid code" to fully
 * enrolled: writes the encrypted backup-code hashes JSON and the enrolment
 * timestamp atomically with `totp_enabled = true`.
 */
export async function completeTotpEnrollment(params: {
  userId: string;
  encryptedBackupCodes: string;
  enrolledAt: Date;
}) {
  await db
    .update(users)
    .set({
      totpEnabled: true,
      totpBackupCodes: params.encryptedBackupCodes,
      totpEnrolledAt: params.enrolledAt,
    })
    .where(eq(users.id, params.userId));
}

/**
 * Reverses {@link completeTotpEnrollment} in a single statement: drops the
 * secret, backup codes, enrolment timestamp, and flips `totp_enabled` off.
 * Used by the disable flow once the user has proven possession with a valid
 * TOTP or backup code.
 */
export async function clearTotpEnrollment(userId: string) {
  await db
    .update(users)
    .set({
      totpSecret: null,
      totpEnabled: false,
      totpBackupCodes: null,
      totpEnrolledAt: null,
    })
    .where(eq(users.id, userId));
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
