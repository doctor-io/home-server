import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    AUTH_SESSION_SECRET: "test-session-secret-32-chars-long-aaaa",
    AUTH_TOTP_ENCRYPTION_KEY: undefined as string | undefined,
  },
}));

vi.mock("@/lib/server/env", () => ({
  serverEnv: mockEnv,
}));

import {
  decryptSecret,
  encryptSecret,
} from "@/lib/server/modules/auth/totp-crypto";

const DEFAULT_SECRET = "test-session-secret-32-chars-long-aaaa";

beforeEach(() => {
  mockEnv.AUTH_SESSION_SECRET = DEFAULT_SECRET;
  mockEnv.AUTH_TOTP_ENCRYPTION_KEY = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("totp-crypto", () => {
  describe("encryptSecret / decryptSecret", () => {
    it("round-trips a plaintext through the packed format", () => {
      const plaintext = "JBSWY3DPEHPK3PXP";
      const packed = encryptSecret(plaintext);

      expect(packed).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
      expect(decryptSecret(packed)).toBe(plaintext);
    });

    it("round-trips multi-byte UTF-8", () => {
      const plaintext = "café — résumé — 🔐 backup\ncodes";
      expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
    });

    it("produces a different ciphertext each call (random IV)", () => {
      const plaintext = "JBSWY3DPEHPK3PXP";
      const a = encryptSecret(plaintext);
      const b = encryptSecret(plaintext);

      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe(plaintext);
      expect(decryptSecret(b)).toBe(plaintext);
    });

    it("rejects a packed string with the wrong number of parts", () => {
      expect(() => decryptSecret("only.two")).toThrowError(
        /Invalid encrypted secret format/,
      );
      expect(() => decryptSecret("a.b.c.d")).toThrowError(
        /Invalid encrypted secret format/,
      );
    });

    it("rejects an IV of the wrong length", () => {
      const packed = encryptSecret("hello");
      const [, cipherPart, tagPart] = packed.split(".");
      // 8-byte IV — too short for AES-GCM-96.
      const shortIv = Buffer.alloc(8, 0).toString("base64");
      expect(() =>
        decryptSecret(`${shortIv}.${cipherPart}.${tagPart}`),
      ).toThrowError(/Invalid encrypted secret format/);
    });

    it("rejects a tag of the wrong length", () => {
      const packed = encryptSecret("hello");
      const [ivPart, cipherPart] = packed.split(".");
      const shortTag = Buffer.alloc(8, 0).toString("base64");
      expect(() =>
        decryptSecret(`${ivPart}.${cipherPart}.${shortTag}`),
      ).toThrowError(/Invalid encrypted secret format/);
    });

    it("throws when the ciphertext is tampered with", () => {
      const packed = encryptSecret("hello");
      const [ivPart, cipherPart, tagPart] = packed.split(".");

      const tampered = Buffer.from(cipherPart, "base64");
      tampered[0] = tampered[0] ^ 0xff;

      expect(() =>
        decryptSecret(`${ivPart}.${tampered.toString("base64")}.${tagPart}`),
      ).toThrow();
    });

    it("throws when the tag is tampered with", () => {
      const packed = encryptSecret("hello");
      const [ivPart, cipherPart, tagPart] = packed.split(".");

      const tampered = Buffer.from(tagPart, "base64");
      tampered[0] = tampered[0] ^ 0xff;

      expect(() =>
        decryptSecret(`${ivPart}.${cipherPart}.${tampered.toString("base64")}`),
      ).toThrow();
    });
  });

  describe("key resolution", () => {
    it("derives a key from AUTH_SESSION_SECRET when no explicit key is set", () => {
      const packed = encryptSecret("secret");
      expect(decryptSecret(packed)).toBe("secret");
    });

    it("cannot decrypt a ciphertext produced with a different AUTH_SESSION_SECRET", () => {
      mockEnv.AUTH_SESSION_SECRET = "first-secret-32-chars-long-aaaaaaaaa";
      const packed = encryptSecret("locked");

      mockEnv.AUTH_SESSION_SECRET = "second-secret-32-chars-long-bbbbbbbb";
      expect(() => decryptSecret(packed)).toThrow();
    });

    it("uses the explicit AUTH_TOTP_ENCRYPTION_KEY when provided", () => {
      const explicitKey = randomBytes(32).toString("base64");
      mockEnv.AUTH_TOTP_ENCRYPTION_KEY = explicitKey;

      const packed = encryptSecret("explicit");
      expect(decryptSecret(packed)).toBe("explicit");
    });

    it("produces a different ciphertext when the explicit key changes", () => {
      const keyA = randomBytes(32).toString("base64");
      const keyB = randomBytes(32).toString("base64");

      mockEnv.AUTH_TOTP_ENCRYPTION_KEY = keyA;
      const packedWithA = encryptSecret("rotate-me");

      mockEnv.AUTH_TOTP_ENCRYPTION_KEY = keyB;
      expect(() => decryptSecret(packedWithA)).toThrow();
    });

    it("rejects an explicit key that does not decode to 32 bytes", () => {
      mockEnv.AUTH_TOTP_ENCRYPTION_KEY = Buffer.alloc(16, 0).toString("base64");
      expect(() => encryptSecret("oops")).toThrowError(
        /AUTH_TOTP_ENCRYPTION_KEY must decode to 32 bytes/,
      );
    });

    it("ignores a whitespace-only AUTH_TOTP_ENCRYPTION_KEY and falls back to HKDF", () => {
      mockEnv.AUTH_TOTP_ENCRYPTION_KEY = "   ";
      const packed = encryptSecret("fallback");
      expect(decryptSecret(packed)).toBe("fallback");
    });
  });
});
