import "server-only";

import { createPublicKey, verify as verifySignature } from "node:crypto";

import {
  isEntitlement,
  isLicensePlan,
  type Entitlement,
  type LicensePlan,
} from "@/lib/shared/contracts/licensing";

/**
 * Offline licence verification.
 *
 * A licence is `base64url(payload).base64url(signature)`, the signature being
 * Ed25519 over the encoded payload string. Verification is local and needs no
 * network: a self-hosted server must keep working with its uplink down, and
 * phoning home to check a licence is not something to inflict on a homelab.
 *
 * This is a lock on an honest door. The core is MIT, so anyone can remove it;
 * the point is to make the paid path the obvious one, not to be unbreakable.
 */

export const LICENSE_VERSION = 1;

/**
 * PLACEHOLDER — replace before issuing a single real licence.
 *
 * This key was generated for development and its private half is not secret,
 * so any licence it validates is forgeable. Generate a keypair, keep the
 * private half offline, and paste the public half here.
 */
export const LICENSE_PUBLIC_KEY_SPKI_BASE64 =
  "MCowBQYDK2VwAyEABgGpPIvSvp86B24sWOgb36XJswLA4+F86zoh9aXw7gs=";

export type LicenseClaims = {
  version: number;
  licensee: string;
  plan: LicensePlan;
  entitlements: Entitlement[];
  issuedAt: string;
  /** Null for a perpetual licence. */
  expiresAt: string | null;
};

export type LicenseFailureReason =
  | "malformed"
  | "bad-signature"
  | "unsupported-version"
  | "invalid-claims"
  | "expired";

export type LicenseVerification =
  | { valid: true; claims: LicenseClaims }
  | { valid: false; reason: LicenseFailureReason };

function decodePublicKey(spkiBase64: string) {
  return createPublicKey({
    key: Buffer.from(spkiBase64, "base64"),
    format: "der",
    type: "spki",
  });
}

function parseClaims(json: unknown): LicenseClaims | null {
  if (typeof json !== "object" || json === null) return null;
  const raw = json as Record<string, unknown>;

  if (typeof raw.licensee !== "string" || !raw.licensee.trim()) return null;
  if (!isLicensePlan(raw.plan)) return null;
  if (typeof raw.issuedAt !== "string" || Number.isNaN(Date.parse(raw.issuedAt))) {
    return null;
  }

  const expiresAt = raw.expiresAt;
  if (expiresAt !== null && expiresAt !== undefined) {
    if (typeof expiresAt !== "string" || Number.isNaN(Date.parse(expiresAt))) {
      return null;
    }
  }

  if (!Array.isArray(raw.entitlements)) return null;
  // An unknown entitlement is dropped rather than failing the licence: a newer
  // issuer may grant something this build has never heard of, and that must not
  // invalidate the entitlements it does understand.
  const entitlements = raw.entitlements.filter(isEntitlement);

  return {
    version: typeof raw.version === "number" ? raw.version : 0,
    licensee: raw.licensee,
    plan: raw.plan,
    entitlements,
    issuedAt: raw.issuedAt,
    expiresAt: typeof expiresAt === "string" ? expiresAt : null,
  };
}

/**
 * Verifies a licence token. `now` and `publicKeySpkiBase64` are injectable so
 * the tests can sign with their own keypair and travel in time; production
 * always uses the baked-in key.
 */
export function verifyLicenseToken(
  token: string,
  options?: { now?: Date; publicKeySpkiBase64?: string },
): LicenseVerification {
  const trimmed = token.trim();
  const separator = trimmed.indexOf(".");
  if (separator <= 0 || separator === trimmed.length - 1) {
    return { valid: false, reason: "malformed" };
  }

  const encodedPayload = trimmed.slice(0, separator);
  const encodedSignature = trimmed.slice(separator + 1);
  if (encodedPayload.includes(".") || encodedSignature.includes(".")) {
    return { valid: false, reason: "malformed" };
  }

  let signatureValid = false;
  try {
    signatureValid = verifySignature(
      null,
      Buffer.from(encodedPayload, "utf8"),
      decodePublicKey(
        options?.publicKeySpkiBase64 ?? LICENSE_PUBLIC_KEY_SPKI_BASE64,
      ),
      Buffer.from(encodedSignature, "base64url"),
    );
  } catch {
    // A signature that is not even decodable is a bad signature, not a crash.
    return { valid: false, reason: "bad-signature" };
  }

  // Checked before the payload is read, so nothing unsigned is ever trusted.
  if (!signatureValid) {
    return { valid: false, reason: "bad-signature" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "malformed" };
  }

  const claims = parseClaims(parsed);
  if (!claims) {
    return { valid: false, reason: "invalid-claims" };
  }
  if (claims.version !== LICENSE_VERSION) {
    return { valid: false, reason: "unsupported-version" };
  }
  if (claims.expiresAt && Date.parse(claims.expiresAt) <= (options?.now ?? new Date()).getTime()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, claims };
}
