import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { apiTokens } from "@/lib/server/db/schema";
import { normalizeScopes } from "@/lib/server/modules/auth/api-token-service";
import type { ApiToken, ApiTokenScope } from "@/lib/shared/contracts/api-tokens";

type Row = typeof apiTokens.$inferSelect;

function toToken(row: Row): ApiToken {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: normalizeScopes(row.scopes),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    lastUsedIp: row.lastUsedIp ?? null,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export async function listApiTokens(): Promise<ApiToken[]> {
  const rows = await db.select().from(apiTokens).orderBy(desc(apiTokens.createdAt));
  return rows.map(toToken);
}

/** Includes the hash, so it is only for the auth path — never for a response. */
export async function findApiTokenByPrefix(prefix: string) {
  const rows = await db.select().from(apiTokens).where(eq(apiTokens.prefix, prefix)).limit(1);
  const row = rows[0];
  return row ? { ...toToken(row), tokenHash: row.tokenHash } : null;
}

export async function createApiToken(input: {
  id: string;
  name: string;
  prefix: string;
  tokenHash: string;
  scopes: ApiTokenScope[];
  expiresAt: Date | null;
}): Promise<ApiToken> {
  const rows = await db
    .insert(apiTokens)
    .values({
      id: input.id,
      name: input.name,
      prefix: input.prefix,
      tokenHash: input.tokenHash,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
    })
    .returning();

  return toToken(rows[0]);
}

/**
 * Revoke rather than delete: the row is the record that a credential existed,
 * and "last used from this IP" stops being answerable once it is gone.
 */
export async function revokeApiToken(id: string): Promise<boolean> {
  const rows = await db
    .update(apiTokens)
    .set({ revokedAt: sql`NOW()` })
    .where(eq(apiTokens.id, id))
    .returning();

  return rows.length > 0;
}

export async function touchApiToken(id: string, ip: string | null): Promise<void> {
  await db
    .update(apiTokens)
    .set({ lastUsedAt: sql`NOW()`, lastUsedIp: ip })
    .where(eq(apiTokens.id, id));
}
