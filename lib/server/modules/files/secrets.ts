import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedSecret = {
  ciphertext: string;
  iv: string;
  tag: string;
};

const KEY_BYTES = 32;
const IV_BYTES = 12;

function decodeBase64Key(keyBase64: string) {
  try {
    return Buffer.from(keyBase64, "base64");
  } catch {
    return null;
  }
}

function resolveSecretKey() {
  const fromEnv = process.env.FILES_CREDENTIALS_KEY;
  if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    const decoded = decodeBase64Key(fromEnv.trim());
    if (decoded && decoded.length === KEY_BYTES) {
      return decoded;
    }

    throw new Error("FILES_CREDENTIALS_KEY must be a base64-encoded 32-byte key");
  }

  const authSecret = process.env.AUTH_SESSION_SECRET || "dev-session-secret-change-me";
  return createHash("sha256")
    .update(`files-credentials:${authSecret}`)
    .digest();
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const key = resolveSecretKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(input: EncryptedSecret) {
  const key = resolveSecretKey();
  const iv = Buffer.from(input.iv, "base64");
  const tag = Buffer.from(input.tag, "base64");
  const ciphertext = Buffer.from(input.ciphertext, "base64");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
