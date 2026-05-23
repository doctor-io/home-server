import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/repository", () => ({
  findUserWithTotpById: vi.fn(),
  setPendingTotpSecret: vi.fn(),
  completeTotpEnrollment: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/totp-crypto", () => ({
  encryptSecret: vi.fn((plaintext: string) => `enc:${plaintext}`),
  decryptSecret: vi.fn((packed: string) => packed.replace(/^enc:/, "")),
}));

vi.mock("@/lib/server/modules/auth/rate-limit", () => ({
  isTotpCodeReplayed: vi.fn(() => false),
  markTotpCodeUsed: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/totp", () => ({
  generateTotpSecret: vi.fn((username: string) => ({
    secret: "JBSWY3DPEHPK3PXP",
    otpAuthUrl: `otpauth://totp/Homeio%3A${encodeURIComponent(username)}?secret=JBSWY3DPEHPK3PXP&issuer=Homeio&algorithm=SHA1&digits=6&period=30`,
  })),
  verifyTotp: vi.fn(),
  generateBackupCodes: vi.fn(async () => ({
    plaintext: ["AAAAAAAAAA", "BBBBBBBBBB"],
    hashes: ["salt-a:hash-a", "salt-b:hash-b"],
  })),
}));

vi.mock("qrcode", () => ({
  toString: vi.fn(async () => '<svg data-mock="qr">…</svg>'),
}));

import {
  TotpServiceError,
  beginTotpEnrollment,
  completeTotpEnrollment,
} from "@/lib/server/modules/auth/totp-service";
import {
  completeTotpEnrollment as persistEnrolledTotp,
  findUserWithTotpById,
  setPendingTotpSecret,
} from "@/lib/server/modules/auth/repository";
import {
  isTotpCodeReplayed,
  markTotpCodeUsed,
} from "@/lib/server/modules/auth/rate-limit";
import {
  decryptSecret,
  encryptSecret,
} from "@/lib/server/modules/auth/totp-crypto";
import { verifyTotp } from "@/lib/server/modules/auth/totp";

const PENDING_USER = {
  id: "user-1",
  username: "admin",
  passwordHash: "hash",
  totpSecret: "enc:JBSWY3DPEHPK3PXP",
  totpEnabled: false,
  totpBackupCodes: null,
  totpEnrolledAt: null,
};

const FRESH_USER = {
  ...PENDING_USER,
  totpSecret: null,
};

beforeEach(() => {
  vi.mocked(findUserWithTotpById).mockReset();
  vi.mocked(setPendingTotpSecret).mockReset();
  vi.mocked(persistEnrolledTotp).mockReset();
  vi.mocked(encryptSecret).mockClear();
  vi.mocked(decryptSecret).mockClear();
  vi.mocked(verifyTotp).mockReset();
  vi.mocked(isTotpCodeReplayed).mockReset().mockReturnValue(false);
  vi.mocked(markTotpCodeUsed).mockReset();
});

describe("beginTotpEnrollment", () => {
  it("generates a secret, stores its ciphertext, and returns SVG + URL", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({ ...FRESH_USER });

    const result = await beginTotpEnrollment("user-1");

    expect(result.secret).toMatch(/^[A-Z2-7]+$/);
    expect(result.otpAuthUrl).toMatch(/^otpauth:\/\/totp\/Homeio%3Aadmin\?/);
    expect(result.qrCodeSvg).toContain("<svg");

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
      ...FRESH_USER,
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

describe("completeTotpEnrollment", () => {
  it("returns the plaintext backup codes and persists the enrolled state on success", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({ ...PENDING_USER });
    vi.mocked(verifyTotp).mockReturnValueOnce(true);

    const result = await completeTotpEnrollment({
      userId: "user-1",
      code: "123456",
    });

    expect(result.enabled).toBe(true);
    expect(result.backupCodes).toEqual(["AAAAAAAAAA", "BBBBBBBBBB"]);
    expect(result.enrolledAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    // The decrypted secret must reach verifyTotp, never the ciphertext.
    expect(vi.mocked(verifyTotp)).toHaveBeenCalledWith(
      "JBSWY3DPEHPK3PXP",
      "123456",
    );

    // The backup-code JSON written to the DB must be encrypted, and must
    // NOT contain the plaintext codes.
    expect(vi.mocked(persistEnrolledTotp)).toHaveBeenCalledTimes(1);
    const stored = vi.mocked(persistEnrolledTotp).mock.calls[0][0];
    expect(stored.userId).toBe("user-1");
    expect(stored.encryptedBackupCodes).toMatch(/^enc:/);
    expect(stored.encryptedBackupCodes).not.toContain("AAAAAAAAAA");
    expect(stored.enrolledAt).toBeInstanceOf(Date);

    // Successful code is marked used so its replay is rejected.
    expect(vi.mocked(markTotpCodeUsed)).toHaveBeenCalledWith(
      "user-1",
      "123456",
    );
  });

  it("rejects with invalid_totp (400) when the code does not verify", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({ ...PENDING_USER });
    vi.mocked(verifyTotp).mockReturnValueOnce(false);

    await expect(
      completeTotpEnrollment({ userId: "user-1", code: "000000" }),
    ).rejects.toMatchObject({
      name: "TotpServiceError",
      code: "invalid_totp",
      statusCode: 400,
    });

    expect(vi.mocked(persistEnrolledTotp)).not.toHaveBeenCalled();
    expect(vi.mocked(markTotpCodeUsed)).not.toHaveBeenCalled();
  });

  it("rejects replays of the most recently accepted code with invalid_totp", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({ ...PENDING_USER });
    vi.mocked(isTotpCodeReplayed).mockReturnValueOnce(true);

    await expect(
      completeTotpEnrollment({ userId: "user-1", code: "123456" }),
    ).rejects.toMatchObject({
      code: "invalid_totp",
      statusCode: 400,
    });

    // Verification must not even run when the replay guard trips, so we
    // don't waste HMAC cycles and the code looks identical to a wrong code.
    expect(vi.mocked(verifyTotp)).not.toHaveBeenCalled();
    expect(vi.mocked(persistEnrolledTotp)).not.toHaveBeenCalled();
  });

  it("rejects with no_pending_enrollment (409) when totp_secret is null", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({ ...FRESH_USER });

    await expect(
      completeTotpEnrollment({ userId: "user-1", code: "123456" }),
    ).rejects.toMatchObject({
      code: "no_pending_enrollment",
      statusCode: 409,
    });
    expect(vi.mocked(verifyTotp)).not.toHaveBeenCalled();
  });

  it("rejects with already_enabled (409) when totp is already turned on", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({
      ...PENDING_USER,
      totpEnabled: true,
      totpEnrolledAt: new Date(),
    });

    await expect(
      completeTotpEnrollment({ userId: "user-1", code: "123456" }),
    ).rejects.toMatchObject({
      code: "already_enabled",
      statusCode: 409,
    });
    expect(vi.mocked(verifyTotp)).not.toHaveBeenCalled();
  });

  it("rejects with invalid_totp when the stored secret cannot be decrypted", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce({ ...PENDING_USER });
    vi.mocked(decryptSecret).mockImplementationOnce(() => {
      throw new Error("auth tag mismatch");
    });

    await expect(
      completeTotpEnrollment({ userId: "user-1", code: "123456" }),
    ).rejects.toMatchObject({
      code: "invalid_totp",
      statusCode: 400,
    });
    expect(vi.mocked(verifyTotp)).not.toHaveBeenCalled();
    expect(vi.mocked(persistEnrolledTotp)).not.toHaveBeenCalled();
  });

  it("returns 401 when the user no longer exists", async () => {
    vi.mocked(findUserWithTotpById).mockResolvedValueOnce(null);

    await expect(
      completeTotpEnrollment({ userId: "ghost", code: "123456" }),
    ).rejects.toMatchObject({
      code: "not_enrolled",
      statusCode: 401,
    });
  });
});
