import "server-only";

import { toString as qrCodeToString } from "qrcode";

import type { TwoFactorErrorCode, TwoFactorSetupResponse } from "@/lib/shared/contracts/auth";
import {
  findUserWithTotpById,
  setPendingTotpSecret,
} from "@/lib/server/modules/auth/repository";
import { encryptSecret } from "@/lib/server/modules/auth/totp-crypto";
import { generateTotpSecret } from "@/lib/server/modules/auth/totp";

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
