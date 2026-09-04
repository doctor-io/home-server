import "server-only";

import { serverEnv } from "@/lib/server/env";
import {
  verifyLicenseToken,
  type LicenseClaims,
  type LicenseFailureReason,
} from "@/lib/server/modules/licensing/license";
import {
  UNLICENSED_SNAPSHOT,
  type Entitlement,
  type EntitlementsSnapshot,
} from "@/lib/shared/contracts/licensing";

/**
 * Resolves what this server is entitled to.
 *
 * The signature check is cached against the token that produced it, because a
 * licence only changes when the operator restarts with a new one. Expiry is
 * re-evaluated on every read instead, so a licence that lapses while the
 * server is up stops granting anything without needing a restart.
 *
 * An expired licence revokes its entitlements. If you ever sell a perpetual
 * licence with time-limited updates, issue it with no expiry and gate updates
 * separately — do not soften this.
 */

type CacheEntry = {
  token: string;
  result:
    | { valid: true; claims: LicenseClaims }
    | { valid: false; reason: LicenseFailureReason };
};

let cache: CacheEntry | null = null;

function verifyCurrentToken(token: string) {
  if (cache?.token === token) return cache.result;

  // Verified without `now`, so the cached result carries the claims and expiry
  // is judged separately, per read.
  const result = verifyLicenseToken(token);
  cache = { token, result };
  return result;
}

export function getEntitlementsSnapshot(now = new Date()): EntitlementsSnapshot {
  const token = serverEnv.HOMEIO_LICENSE?.trim();
  if (!token) return UNLICENSED_SNAPSHOT;

  const result = verifyCurrentToken(token);
  if (!result.valid) {
    return { ...UNLICENSED_SNAPSHOT, status: "invalid" };
  }

  const { claims } = result;
  const expired =
    claims.expiresAt !== null && Date.parse(claims.expiresAt) <= now.getTime();

  if (expired) {
    return {
      status: "expired",
      plan: "free",
      entitlements: [],
      licensedTo: claims.licensee,
      expiresAt: claims.expiresAt,
    };
  }

  return {
    status: "active",
    plan: claims.plan,
    entitlements: claims.entitlements,
    licensedTo: claims.licensee,
    expiresAt: claims.expiresAt,
  };
}

export function hasEntitlement(entitlement: Entitlement, now = new Date()): boolean {
  return getEntitlementsSnapshot(now).entitlements.includes(entitlement);
}

/** Test-only: the cache is keyed on a token that does not change at runtime. */
export function resetEntitlementsCache(): void {
  cache = null;
}
