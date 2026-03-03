import "server-only";

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

export async function hashPassword(plainPassword: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(
    plainPassword,
    salt,
    SCRYPT_KEY_LENGTH,
  )) as Buffer;

  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  plainPassword: string,
  storedPasswordHash: string,
) {
  const [salt, hashHex] = storedPasswordHash.split(":");

  if (!salt || !hashHex) return false;

  const derived = (await scrypt(
    plainPassword,
    salt,
    SCRYPT_KEY_LENGTH,
  )) as Buffer;
  const hash = Buffer.from(hashHex, "hex");

  if (hash.length !== derived.length) return false;

  return timingSafeEqual(hash, derived);
}
