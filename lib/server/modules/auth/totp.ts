import "server-only";

import {
  createHmac,
  randomBytes,
  randomInt,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

const TOTP_ISSUER = "Homeio";
const TOTP_ALGORITHM = "SHA1" as const;
const TOTP_DIGITS = 6;
const TOTP_STEP_SECONDS = 30;
const TOTP_T0 = 0;
const TOTP_SECRET_BYTES = 20;
const TOTP_DEFAULT_WINDOW = 1;

const BACKUP_CODE_LENGTH = 10;
const BACKUP_CODE_DEFAULT_COUNT = 10;
// 32-character alphabet that drops the visually ambiguous 0/1/I/L/O so
// users can read codes off paper without guessing.
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BACKUP_CODE_SCRYPT_KEY_LENGTH = 64;
const BACKUP_CODE_SALT_BYTES = 16;
const BACKUP_CODE_HASH_DELIMITER = ":";

// RFC 4648 base32 alphabet — what every authenticator app expects in the
// otpauth:// URL secret.
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) {
      throw new Error(`Invalid base32 character: ${char}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export interface TotpEnrollment {
  secret: string;
  otpAuthUrl: string;
}

export interface VerifyTotpOptions {
  window?: number;
  now?: number;
  digits?: number;
  step?: number;
}

export interface BackupCodes {
  plaintext: string[];
  hashes: string[];
}

export interface VerifyBackupCodeResult {
  matchedHash: string | null;
}

/**
 * Generates a fresh 160-bit TOTP secret (base32-encoded, no padding) plus
 * a ready-to-render otpauth:// URL. The URL embeds issuer/account so apps
 * like Google Authenticator label the entry correctly after scanning.
 */
export function generateTotpSecret(username: string): TotpEnrollment {
  const secret = base32Encode(randomBytes(TOTP_SECRET_BYTES));
  const otpAuthUrl = buildOtpAuthUrl(secret, username);
  return { secret, otpAuthUrl };
}

function buildOtpAuthUrl(secret: string, username: string): string {
  const label = encodeURIComponent(`${TOTP_ISSUER}:${username}`);
  const params = new URLSearchParams({
    secret,
    issuer: TOTP_ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * RFC 4226 HOTP. Exposed for tests; not part of the public auth API.
 */
export function hotp(
  secret: Buffer,
  counter: number | bigint,
  digits = TOTP_DIGITS,
): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(counterBuf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const modulus = 10 ** digits;
  return (binary % modulus).toString().padStart(digits, "0");
}

/**
 * RFC 6238 TOTP. Exposed for tests; the public API is {@link verifyTotp}.
 */
export function totp(
  secret: Buffer,
  unixSeconds: number,
  options: { step?: number; t0?: number; digits?: number } = {},
): string {
  const step = options.step ?? TOTP_STEP_SECONDS;
  const t0 = options.t0 ?? TOTP_T0;
  const digits = options.digits ?? TOTP_DIGITS;
  const counter = Math.floor((unixSeconds - t0) / step);
  return hotp(secret, counter, digits);
}

/**
 * Checks a user-supplied TOTP code against the stored base32 secret.
 * `window` extends acceptance to that many steps on either side of the
 * current step, smoothing over clock drift between the device and host.
 * Comparison is constant-time.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: VerifyTotpOptions = {},
): boolean {
  const digits = options.digits ?? TOTP_DIGITS;
  const window = options.window ?? TOTP_DEFAULT_WINDOW;
  const step = options.step ?? TOTP_STEP_SECONDS;
  const now = options.now ?? Math.floor(Date.now() / 1000);

  // Strip whitespace AND dashes so a user pasting `123-456` (or `123 456`)
  // is accepted everywhere. Matches the input handling in totp-service.ts
  // so the shape gate there cannot disagree with this final check.
  const trimmed = code.replace(/[\s-]+/g, "");
  if (!new RegExp(`^\\d{${digits}}$`).test(trimmed)) {
    return false;
  }

  let secretBuf: Buffer;
  try {
    secretBuf = base32Decode(secret);
  } catch {
    return false;
  }

  const codeBuf = Buffer.from(trimmed, "utf8");
  for (let offset = -window; offset <= window; offset++) {
    const candidate = totp(secretBuf, now + offset * step, { step, digits });
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (
      candidateBuf.length === codeBuf.length &&
      timingSafeEqual(candidateBuf, codeBuf)
    ) {
      return true;
    }
  }
  return false;
}

function randomBackupCode(): string {
  let code = "";
  for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
    code += BACKUP_CODE_ALPHABET[randomInt(BACKUP_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Normalises user-entered backup codes: strips whitespace and dashes,
 * upper-cases letters. UI is free to display codes with separators.
 */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]+/g, "").toUpperCase();
}

async function hashBackupCode(code: string, salt: string): Promise<string> {
  const derived = (await scrypt(
    code,
    salt,
    BACKUP_CODE_SCRYPT_KEY_LENGTH,
  )) as Buffer;
  return `${salt}${BACKUP_CODE_HASH_DELIMITER}${derived.toString("hex")}`;
}

/**
 * Generates `count` random backup codes plus their scrypt hashes. Caller
 * stores only the hashes; the plaintext list is shown to the user exactly
 * once and never read back.
 */
export async function generateBackupCodes(
  count = BACKUP_CODE_DEFAULT_COUNT,
): Promise<BackupCodes> {
  if (count <= 0) {
    throw new Error("Backup code count must be positive");
  }

  const plaintext: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBackupCode();
    const salt = randomBytes(BACKUP_CODE_SALT_BYTES).toString("hex");
    plaintext.push(code);
    hashes.push(await hashBackupCode(code, salt));
  }
  return { plaintext, hashes };
}

/**
 * Compares a user-entered backup code against stored hashes. Returns the
 * matching hash so callers can remove a consumed code from storage.
 * Comparison is constant-time per slot; callers should treat returning
 * `null` as a generic "invalid".
 */
export async function verifyBackupCode(
  hashes: string[],
  code: string,
): Promise<VerifyBackupCodeResult> {
  const normalized = normalizeBackupCode(code);
  if (normalized.length !== BACKUP_CODE_LENGTH) {
    return { matchedHash: null };
  }

  for (const stored of hashes) {
    const sep = stored.indexOf(BACKUP_CODE_HASH_DELIMITER);
    if (sep <= 0) continue;
    const salt = stored.slice(0, sep);
    const hashHex = stored.slice(sep + 1);
    if (!hashHex) continue;

    const candidate = (await scrypt(
      normalized,
      salt,
      BACKUP_CODE_SCRYPT_KEY_LENGTH,
    )) as Buffer;
    const storedBuf = Buffer.from(hashHex, "hex");
    if (
      storedBuf.length === candidate.length &&
      timingSafeEqual(storedBuf, candidate)
    ) {
      return { matchedHash: stored };
    }
  }

  return { matchedHash: null };
}
