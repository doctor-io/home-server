import { describe, expect, it } from "vitest";

import {
  generateBackupCodes,
  generateTotpSecret,
  hotp,
  normalizeBackupCode,
  totp,
  verifyBackupCode,
  verifyTotp,
} from "@/lib/server/modules/auth/totp";

// RFC 6238 Appendix B reference: 20-byte ASCII secret "12345678901234567890".
const RFC6238_SHA1_SECRET = Buffer.from("12345678901234567890", "utf8");

const RFC6238_VECTORS: Array<{ time: number; expected: string }> = [
  { time: 59, expected: "94287082" },
  { time: 1111111109, expected: "07081804" },
  { time: 1111111111, expected: "14050471" },
  { time: 1234567890, expected: "89005924" },
  { time: 2000000000, expected: "69279037" },
  { time: 20000000000, expected: "65353130" },
];

describe("totp", () => {
  describe("RFC 6238 reference vectors", () => {
    it.each(RFC6238_VECTORS)(
      "matches the 8-digit code at T=$time",
      ({ time, expected }) => {
        expect(totp(RFC6238_SHA1_SECRET, time, { digits: 8 })).toBe(expected);
      },
    );

    it("derives the 6-digit code from the same underlying HOTP value", () => {
      // 94287082 truncated to 6 digits is 287082.
      expect(totp(RFC6238_SHA1_SECRET, 59, { digits: 6 })).toBe("287082");
    });
  });

  describe("hotp", () => {
    // RFC 4226 Appendix D — same secret, counters 0..9.
    const HOTP_VECTORS = [
      { counter: 0, expected: "755224" },
      { counter: 1, expected: "287082" },
      { counter: 2, expected: "359152" },
      { counter: 3, expected: "969429" },
      { counter: 4, expected: "338314" },
      { counter: 5, expected: "254676" },
      { counter: 6, expected: "287922" },
      { counter: 7, expected: "162583" },
      { counter: 8, expected: "399871" },
      { counter: 9, expected: "520489" },
    ];

    it.each(HOTP_VECTORS)(
      "matches the RFC 4226 vector at counter=$counter",
      ({ counter, expected }) => {
        expect(hotp(RFC6238_SHA1_SECRET, counter, 6)).toBe(expected);
      },
    );
  });

  describe("generateTotpSecret", () => {
    it("returns a base32 secret of the expected length", () => {
      const { secret } = generateTotpSecret("admin");
      // 20 random bytes => ceil(160/5) = 32 base32 chars.
      expect(secret).toHaveLength(32);
      expect(secret).toMatch(/^[A-Z2-7]+$/);
    });

    it("produces a different secret on each call", () => {
      const a = generateTotpSecret("admin").secret;
      const b = generateTotpSecret("admin").secret;
      expect(a).not.toBe(b);
    });

    it("builds an otpauth URL with issuer, account, and TOTP params", () => {
      const { secret, otpAuthUrl } = generateTotpSecret("admin");
      expect(otpAuthUrl.startsWith("otpauth://totp/Homeio%3Aadmin?")).toBe(
        true,
      );
      const query = new URL(otpAuthUrl).searchParams;
      expect(query.get("secret")).toBe(secret);
      expect(query.get("issuer")).toBe("Homeio");
      expect(query.get("algorithm")).toBe("SHA1");
      expect(query.get("digits")).toBe("6");
      expect(query.get("period")).toBe("30");
    });

    it("percent-encodes usernames with special characters", () => {
      const { otpAuthUrl } = generateTotpSecret("admin user@example");
      // "@" must be %40 inside the path label per RFC 3986.
      expect(otpAuthUrl).toContain("Homeio%3Aadmin%20user%40example");
    });
  });

  describe("verifyTotp", () => {
    // 8-byte all-zero buffer base32-encodes to "AAAAAAAAAAAAA" (13 chars).
    const FIXED_SECRET = "AAAAAAAAAAAAA";
    const NOW = 1700000000;

    it("accepts the current step", () => {
      const code = totp(Buffer.alloc(8, 0), NOW);
      expect(verifyTotp(FIXED_SECRET, code, { now: NOW })).toBe(true);
    });

    it("accepts the previous step within window=1", () => {
      const code = totp(Buffer.alloc(8, 0), NOW - 30);
      expect(verifyTotp(FIXED_SECRET, code, { now: NOW, window: 1 })).toBe(
        true,
      );
    });

    it("accepts the next step within window=1", () => {
      const code = totp(Buffer.alloc(8, 0), NOW + 30);
      expect(verifyTotp(FIXED_SECRET, code, { now: NOW, window: 1 })).toBe(
        true,
      );
    });

    it("rejects a code from two steps ago when window=1", () => {
      const code = totp(Buffer.alloc(8, 0), NOW - 60);
      expect(verifyTotp(FIXED_SECRET, code, { now: NOW, window: 1 })).toBe(
        false,
      );
    });

    it("rejects a 6-digit code that does not match any window step", () => {
      expect(verifyTotp(FIXED_SECRET, "000000", { now: NOW })).toBe(false);
    });

    it("rejects malformed codes (non-numeric, wrong length)", () => {
      expect(verifyTotp(FIXED_SECRET, "abcdef", { now: NOW })).toBe(false);
      expect(verifyTotp(FIXED_SECRET, "12345", { now: NOW })).toBe(false);
      expect(verifyTotp(FIXED_SECRET, "1234567", { now: NOW })).toBe(false);
      expect(verifyTotp(FIXED_SECRET, "", { now: NOW })).toBe(false);
    });

    it("rejects rather than throwing when the stored secret is malformed", () => {
      expect(verifyTotp("not-base32!!", "123456", { now: NOW })).toBe(false);
    });

    it("tolerates whitespace inside user-entered codes", () => {
      const code = totp(Buffer.alloc(8, 0), NOW);
      const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
      expect(verifyTotp(FIXED_SECRET, spaced, { now: NOW })).toBe(true);
    });
  });

  describe("generateBackupCodes", () => {
    it("produces the requested number of plaintext codes and hashes", async () => {
      const { plaintext, hashes } = await generateBackupCodes(10);
      expect(plaintext).toHaveLength(10);
      expect(hashes).toHaveLength(10);
    });

    it("plaintext codes are 10 chars from the unambiguous alphabet", async () => {
      const { plaintext } = await generateBackupCodes(10);
      for (const code of plaintext) {
        expect(code).toHaveLength(10);
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
      }
    });

    it("plaintext codes are unique within a batch", async () => {
      const { plaintext } = await generateBackupCodes(10);
      expect(new Set(plaintext).size).toBe(plaintext.length);
    });

    it("stored hashes never contain the plaintext code", async () => {
      const { plaintext, hashes } = await generateBackupCodes(10);
      for (let i = 0; i < hashes.length; i++) {
        expect(hashes[i]).not.toContain(plaintext[i]);
      }
    });

    it("hashes are salted — repeating the same code yields different storage", async () => {
      // Generate enough codes that any duplicate plaintext would be improbable,
      // then check that all hashes are distinct (salt makes this true even
      // if plaintexts collided).
      const { hashes } = await generateBackupCodes(10);
      expect(new Set(hashes).size).toBe(hashes.length);
    });

    it("rejects a non-positive count", async () => {
      await expect(generateBackupCodes(0)).rejects.toThrow(/positive/);
      await expect(generateBackupCodes(-1)).rejects.toThrow(/positive/);
    });
  });

  describe("verifyBackupCode", () => {
    it("returns the matched hash for a valid code", async () => {
      const { plaintext, hashes } = await generateBackupCodes(3);
      const result = await verifyBackupCode(hashes, plaintext[1]);
      expect(result.matchedHash).toBe(hashes[1]);
    });

    it("returns null when the code does not match any stored hash", async () => {
      const { hashes } = await generateBackupCodes(3);
      const result = await verifyBackupCode(hashes, "ZZZZZZZZZZ");
      expect(result.matchedHash).toBeNull();
    });

    it("returns null on an empty hash list", async () => {
      const result = await verifyBackupCode([], "ABCDEFGHJK");
      expect(result.matchedHash).toBeNull();
    });

    it("accepts case-insensitive and dash-separated user input", async () => {
      const { plaintext, hashes } = await generateBackupCodes(1);
      const original = plaintext[0];
      const formatted = `${original.slice(0, 5).toLowerCase()}-${original
        .slice(5)
        .toLowerCase()}`;
      const result = await verifyBackupCode(hashes, formatted);
      expect(result.matchedHash).toBe(hashes[0]);
    });

    it("rejects codes whose normalised length is wrong without hashing", async () => {
      const { hashes } = await generateBackupCodes(1);
      const result = await verifyBackupCode(hashes, "TOO-SHORT");
      expect(result.matchedHash).toBeNull();
    });

    it("ignores stored entries without a salt delimiter", async () => {
      const { plaintext, hashes } = await generateBackupCodes(1);
      const result = await verifyBackupCode(
        ["malformed-no-delimiter", ...hashes],
        plaintext[0],
      );
      expect(result.matchedHash).toBe(hashes[0]);
    });
  });

  describe("normalizeBackupCode", () => {
    it("strips dashes and whitespace and upper-cases letters", () => {
      expect(normalizeBackupCode(" abc-de  fghj ")).toBe("ABCDEFGHJ");
    });
  });
});
