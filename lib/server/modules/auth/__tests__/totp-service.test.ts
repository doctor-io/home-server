import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/repository", () => ({
  findUserWithTotpById: vi.fn(),
  setPendingTotpSecret: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/totp-crypto", () => ({
  encryptSecret: vi.fn((plaintext: string) => `enc:${plaintext}`),
  decryptSecret: vi.fn((packed: string) => packed.replace(/^enc:/, "")),
}));

vi.mock("qrcode", () => ({
  toString: vi.fn(async () => '<svg data-mock="qr">…</svg>'),
}));

import {
  TotpServiceError,
  beginTotpEnrollment,
} from "@/lib/server/modules/auth/totp-service";
import {
  findUserWithTotpById,
  setPendingTotpSecret,
} from "@/lib/server/modules/auth/repository";
import { encryptSecret } from "@/lib/server/modules/auth/totp-crypto";

const ENROLLED_USER = {
  id: "user-1",
  username: "admin",
  passwordHash: "hash",
  totpSecret: null,
  totpEnabled: false,
  totpBackupCodes: null,
  totpEnrolledAt: null,
};

beforeEach(() => {
  vi.mocked(findUserWithTotpById).mockReset();
  vi.mocked(setPendingTotpSecret).mockReset();
  vi.mocked(encryptSecret).mockClear();
});

describe("beginTotpEnrollment", () => {
  it("generates a secret, stores its ciphertext, and returns SVG + URL", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({ ...ENROLLED_USER });

    const result = await beginTotpEnrollment("user-1");

    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.otpAuthUrl).toMatch(/^otpauth:\/\/totp\/Homeio%3Aadmin\?/);
    expect(result.qrCodeSvg).toContain("<svg");

    // The stored secret must be the encrypted form, never the plaintext.
    expect(vi.mocked(setPendingTotpSecret)).toHaveBeenCalledTimes(1);
    const [storedUserId, storedCiphertext] = vi
      .mocked(setPendingTotpSecret)
      .mock.calls[0];
    expect(storedUserId).toBe("user-1");
    expect(storedCiphertext).toBe(`enc:${result.secret}`);
    expect(storedCiphertext).not.toBe(result.secret);
  });

  it("rejects with 'already_enabled' (409) when totp_enabled is true", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({
      ...ENROLLED_USER,
      totpEnabled: true,
      totpEnrolledAt: new Date(),
    });

    await expect(beginTotpEnrollment("user-1")).rejects.toMatchObject({
      name: "TotpServiceError",
      code: "already_enabled",
      statusCode: 409,
    });
    expect(vi.mocked(setPendingTotpSecret)).not.toHaveBeenCalled();
  });

  it("rejects with 401 when the user row no longer exists", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce(null);

    const error = await beginTotpEnrollment("ghost-user").catch((e) => e);
    expect(error).toBeInstanceOf(TotpServiceError);
    expect(error.statusCode).toBe(401);
    expect(vi.mocked(setPendingTotpSecret)).not.toHaveBeenCalled();
  });
});
