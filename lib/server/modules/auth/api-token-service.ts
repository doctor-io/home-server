import "server-only";

import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import {
  isApiTokenScope,
  type ApiTokenScope,
} from "@/lib/shared/contracts/api-tokens";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

/** Recognisable in a log or a header without being mistaken for anything else. */
const TOKEN_PREFIX = "homeio_";
const PREFIX_LENGTH = 8;

export type GeneratedToken = {
  token: string;
  prefix: string;
  tokenHash: string;
  id: string;
};

/**
 * The prefix is stored in clear and indexed so validation can find the one
 * candidate row and hash against it, rather than scrypt-ing every row in the
 * table. It is not a secret: it identifies, the remainder authenticates.
 */
export function prefixOf(token: string): string {
  return token.slice(0, TOKEN_PREFIX.length + PREFIX_LENGTH);
}

export async function hashToken(token: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(token, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyToken(token: string, storedHash: string): Promise<boolean> {
  const [salt, digest] = storedHash.split(":");
  if (!salt || !digest) return false;

  const derived = (await scrypt(token, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(digest, "hex");

  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false.
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(expected, derived);
}

export async function generateApiToken(): Promise<GeneratedToken> {
  // 32 bytes of base64url — long enough that the prefix being public costs
  // nothing, and URL-safe so it survives being pasted into a header or a config.
  const secret = randomBytes(32).toString("base64url");
  const token = `${TOKEN_PREFIX}${secret}`;

  return {
    token,
    prefix: prefixOf(token),
    tokenHash: await hashToken(token),
    id: randomUUID(),
  };
}

export function normalizeScopes(input: unknown): ApiTokenScope[] {
  if (!Array.isArray(input)) return [];
  // Deduplicated and filtered: an unknown scope is dropped rather than stored,
  // so a scope removed in a later release cannot linger as a grant.
  return Array.from(new Set(input.filter(isApiTokenScope)));
}

export function isExpired(expiresAt: string | Date | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= now.getTime();
}

/** A token is usable only if it exists, is not revoked, and has not expired. */
export function isUsable(
  token: { revokedAt: string | Date | null; expiresAt: string | Date | null },
  now = new Date(),
): boolean {
  if (token.revokedAt) return false;
  return !isExpired(token.expiresAt, now);
}

export function hasScope(scopes: ApiTokenScope[], required: ApiTokenScope): boolean {
  return scopes.includes(required);
}
