import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { serverEnv } from "@/lib/server/env";

const ALGORITHM = "aes-256-gcm" as const;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HKDF_DIGEST = "sha256" as const;
const HKDF_SALT = Buffer.from("homeio.totp.v1.salt", "utf8");
const HKDF_INFO = Buffer.from("homeio.totp.secret-encryption", "utf8");
const PACKED_PART_COUNT = 3;
const PACKED_SEPARATOR = ".";

const INVALID_FORMAT_MESSAGE = "Invalid encrypted secret format";

function decodeExplicitKey(base64: string): Buffer {
  const decoded = Buffer.from(base64, "base64");
  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `AUTH_TOTP_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes`,
    );
  }
  return decoded;
}

function deriveKeyFromSessionSecret(sessionSecret: string): Buffer {
  // RFC 5869 HKDF — salt + info give domain separation so a future key
  // derived from the same AUTH_SESSION_SECRET cannot collide with this one.
  const derived = hkdfSync(
    HKDF_DIGEST,
    sessionSecret,
    HKDF_SALT,
    HKDF_INFO,
    KEY_BYTES,
  );
  return Buffer.from(derived);
}

function resolveEncryptionKey(): Buffer {
  const explicit = serverEnv.AUTH_TOTP_ENCRYPTION_KEY?.trim();
  if (explicit) {
    return decodeExplicitKey(explicit);
  }
  return deriveKeyFromSessionSecret(serverEnv.AUTH_SESSION_SECRET);
}

/**
 * Encrypts a TOTP secret (or backup-code JSON) with AES-256-GCM and packs
 * the IV, ciphertext, and authentication tag into a single base64 string
 * of the form `<iv>.<cipher>.<tag>`. A fresh 96-bit IV is generated per
 * call — never reuse an IV with the same key.
 */
export function encryptSecret(plaintext: string): string {
  const key = resolveEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    ciphertext.toString("base64"),
    tag.toString("base64"),
  ].join(PACKED_SEPARATOR);
}

/**
 * Reverses {@link encryptSecret}. Throws if the packed format is malformed
 * or if AES-GCM authentication fails (tampering, wrong key, truncated tag).
 */
export function decryptSecret(packed: string): string {
  const parts = packed.split(PACKED_SEPARATOR);
  if (parts.length !== PACKED_PART_COUNT) {
    throw new Error(INVALID_FORMAT_MESSAGE);
  }
  const [ivPart, cipherPart, tagPart] = parts;

  const iv = Buffer.from(ivPart, "base64");
  const ciphertext = Buffer.from(cipherPart, "base64");
  const tag = Buffer.from(tagPart, "base64");

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error(INVALID_FORMAT_MESSAGE);
  }

  const key = resolveEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
