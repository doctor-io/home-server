import "server-only";

import { toString as qrCodeToString } from "qrcode";

import type {
  TwoFactorErrorCode,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
} from "@/lib/shared/contracts/auth";
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
import {
  generateBackupCodes,
  generateTotpSecret,
  verifyTotp,
} from "@/lib/server/modules/auth/totp";

export class TotpServiceError extends Error {
  readonly code: TwoFactorErrorCode;
  readonly statusCode: number;

  constructor(
    message: string,
    options: { code: TwoFactorErrorCode; statusCode: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "TotpServiceError";
    this.code = options.code;
    this.statusCode = options.statusCode;
  }
}

// Higher error correction makes the QR more robust to print/scan glitches
// at the cost of a few extra modules; "M" is the qrcode default but we
// pick it explicitly to be defensive against library default drift.
const QR_OPTIONS = {
  type: "svg" as const,
  errorCorrectionLevel: "M" as const,
  margin: 1,
};

/**
 * Starts enrolment for a user that has not yet confirmed TOTP. Generates a
 * fresh secret, stores it encrypted on the user row (leaving `totp_enabled`
 * false), and returns the secret + otpauth URL + inline SVG QR.
 *
 * Throws {@link TotpServiceError} with code `already_enabled` (HTTP 409)
 * if the caller already completed enrolment. Callers must disable first.
 */
export async function beginTotpEnrollment(
  userId: string,
): Promise<TwoFactorSetupResponse> {
  const user = await findUserWithTotpById(userId);
  if (!user) {
    // The session pointed at a userId that no longer exists. Treat as
    // unauthenticated by the time we get here — this should be exceedingly
    // rare; we still surface a 401-shaped error rather than 500.
    throw new TotpServiceError("User not found", {
      code: "not_enrolled",
      statusCode: 401,
    });
  }

  if (user.totpEnabled) {
    throw new TotpServiceError(
      "Two-factor authentication is already enabled. Disable it first.",
      { code: "already_enabled", statusCode: 409 },
    );
  }

  const { secret, otpAuthUrl } = generateTotpSecret(user.username);
  await setPendingTotpSecret(user.id, encryptSecret(secret));

  const qrCodeSvg = await qrCodeToString(otpAuthUrl, QR_OPTIONS);

  return { secret, otpAuthUrl, qrCodeSvg };
}

/**
 * Confirms a pending enrolment: validates the first TOTP code, generates
 * ten single-use backup codes, and flips `totp_enabled` on. Returns the
 * plaintext backup codes — the caller MUST surface them to the user
 * exactly once; only their hashes are persisted.
 *
 * Error mapping:
 * - 401 `not_enrolled` — session points at a non-existent user (shouldn't
 *   happen in practice, but we surface it explicitly).
 * - 409 `already_enabled` — verify called after enrolment is complete.
 * - 409 `no_pending_enrollment` — no `totp_secret` stored; caller must
 *   hit `/2fa/setup` first.
 * - 400 `invalid_totp` — code did not match (also covers replays of the
 *   most recently accepted code within the drift window).
 */
export async function completeTotpEnrollment(params: {
  userId: string;
  code: string;
}): Promise<TwoFactorVerifyResponse> {
  const user = await findUserWithTotpById(params.userId);
  if (!user) {
    throw new TotpServiceError("User not found", {
      code: "not_enrolled",
      statusCode: 401,
    });
  }

  if (user.totpEnabled) {
    throw new TotpServiceError(
      "Two-factor authentication is already enabled.",
      { code: "already_enabled", statusCode: 409 },
    );
  }

  if (!user.totpSecret) {
    throw new TotpServiceError(
      "No pending two-factor enrolment. Start setup first.",
      { code: "no_pending_enrollment", statusCode: 409 },
    );
  }

  // Replay check runs before HMAC verification so a leaked-and-reused code
  // is rejected with the same shape as a wrong code (no oracle for the
  // attacker about whether a code was ever valid).
  if (isTotpCodeReplayed(user.id, params.code)) {
    throw new TotpServiceError("Invalid verification code", {
      code: "invalid_totp",
      statusCode: 400,
    });
  }

  let plaintextSecret: string;
  try {
    plaintextSecret = decryptSecret(user.totpSecret);
  } catch (cause) {
    // Corrupt or wrong-key ciphertext: surface as invalid_totp so we do
    // not leak details, but log via the thrown cause for operators.
    throw new TotpServiceError("Stored TOTP secret is unreadable", {
      code: "invalid_totp",
      statusCode: 400,
      cause,
    });
  }

  if (!verifyTotp(plaintextSecret, params.code)) {
    throw new TotpServiceError("Invalid verification code", {
      code: "invalid_totp",
      statusCode: 400,
    });
  }

  // Generate + persist backup codes BEFORE returning so a transient DB
  // failure doesn't leave the user thinking 2FA is enabled while the DB
  // still says otherwise.
  const { plaintext, hashes } = await generateBackupCodes();
  const enrolledAt = new Date();
  await persistEnrolledTotp({
    userId: user.id,
    encryptedBackupCodes: encryptSecret(JSON.stringify(hashes)),
    enrolledAt,
  });

  markTotpCodeUsed(user.id, params.code);

  return {
    enabled: true,
    enrolledAt: enrolledAt.toISOString(),
    backupCodes: plaintext,
  };
}
