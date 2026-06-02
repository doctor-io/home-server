import "server-only";

import { randomUUID } from "node:crypto";
import { toString as qrCodeToString } from "qrcode";

import type {
  TwoFactorDisableResponse,
  TwoFactorErrorCode,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
} from "@/lib/shared/contracts/auth";
import { serverEnv } from "@/lib/server/env";
import {
  clearTotpEnrollment as persistClearedTotp,
  completeTotpEnrollment as persistEnrolledTotp,
  createSession,
  deleteSessionsForUser,
  findUserWithTotpById,
  setPendingTotpSecret,
  updateTotpBackupCodes,
} from "@/lib/server/modules/auth/repository";
import { verifyPartialAuthToken } from "@/lib/server/modules/auth/partial-auth-token";
import {
  isPartialAuthTokenBlocked,
  isPartialAuthTokenConsumed,
  isTotpCodeReplayed,
  markPartialAuthTokenConsumed,
  markTotpCodeUsed,
  recordPartialAuthFailure,
} from "@/lib/server/modules/auth/rate-limit";
import { createSessionToken } from "@/lib/server/modules/auth/session-token";
import {
  decryptSecret,
  encryptSecret,
} from "@/lib/server/modules/auth/totp-crypto";
import {
  generateBackupCodes,
  generateTotpSecret,
  verifyBackupCode,
  verifyTotp,
} from "@/lib/server/modules/auth/totp";

/**
 * Short, code-driven strings returned in the response body. Kept narrow on
 * purpose — operational detail like "stored backup codes are unreadable"
 * should never leak to a probing attacker; that goes to logs only.
 */
const TOTP_PUBLIC_MESSAGES: Record<TwoFactorErrorCode, string> = {
  invalid_totp: "Invalid verification code",
  invalid_backup_code: "Invalid backup code",
  already_enabled: "Two-factor authentication is already enabled",
  not_enabled: "Two-factor authentication is not enabled",
  not_enrolled: "Two-factor authentication is not enrolled",
  no_pending_enrollment: "No pending two-factor enrolment",
  partial_auth_expired:
    "Two-factor login session expired. Please sign in again.",
  partial_auth_consumed:
    "Two-factor login session already used. Please sign in again.",
  too_many_attempts: "Too many failed attempts. Try again shortly.",
};

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

  /**
   * The string that's safe to return to API callers. Routes should prefer
   * this over `error.message`, which may carry operational detail intended
   * for logs only.
   */
  get publicMessage(): string {
    return TOTP_PUBLIC_MESSAGES[this.code];
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
  const stored = await setPendingTotpSecret(user.id, encryptSecret(secret));
  if (!stored) {
    // CAS failed: a concurrent /verify completed enrolment between our read
    // above and our write here. Treat as already_enabled; the caller can
    // disable and retry. Prevents handing out a QR for a secret the DB will
    // never accept.
    throw new TotpServiceError(
      "Two-factor authentication is already enabled. Disable it first.",
      { code: "already_enabled", statusCode: 409 },
    );
  }

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
  const persisted = await persistEnrolledTotp({
    userId: user.id,
    encryptedBackupCodes: encryptSecret(JSON.stringify(hashes)),
    enrolledAt,
  });
  if (!persisted) {
    // CAS lost: a concurrent /verify (e.g., double-click in the UI) flipped
    // totp_enabled to true between our read and our write. The other request
    // already returned its own backup codes to a client. We must NOT return
    // OUR plaintext codes here — those codes do not exist in the DB, so the
    // user would be locked out of recovery. Fail closed.
    throw new TotpServiceError(
      "Two-factor authentication is already enabled.",
      { code: "already_enabled", statusCode: 409 },
    );
  }

  markTotpCodeUsed(user.id, params.code);

  return {
    enabled: true,
    enrolledAt: enrolledAt.toISOString(),
    backupCodes: plaintext,
  };
}

const TOTP_CODE_PATTERN = /^\d{6}$/;

/**
 * Turns 2FA off for an already-enrolled user. The caller must prove
 * possession of the second factor with either a current TOTP code or one of
 * their unused backup codes. On success the entire enrolment is cleared
 * (`totp_secret`, `totp_enabled`, `totp_backup_codes`, `totp_enrolled_at`)
 * — there's no point preserving the consumed backup code separately because
 * everything goes back to null.
 *
 * Error mapping:
 * - 401 `not_enrolled` — session points at a non-existent user row.
 * - 409 `not_enabled` — TOTP isn't currently turned on for this user.
 * - 400 `invalid_totp` — code didn't match TOTP or any stored backup,
 *   was a replay, or the stored ciphertext is unreadable. We return one
 *   shape regardless of which path failed so the response doesn't leak
 *   whether a TOTP or backup-code attempt was closer.
 */
export async function disableTotp(params: {
  userId: string;
  code: string;
}): Promise<TwoFactorDisableResponse> {
  const user = await findUserWithTotpById(params.userId);
  if (!user) {
    throw new TotpServiceError("User not found", {
      code: "not_enrolled",
      statusCode: 401,
    });
  }

  if (!user.totpEnabled) {
    throw new TotpServiceError(
      "Two-factor authentication is not enabled.",
      { code: "not_enabled", statusCode: 409 },
    );
  }

  if (isTotpCodeReplayed(user.id, params.code)) {
    throw new TotpServiceError("Invalid verification code", {
      code: "invalid_totp",
      statusCode: 400,
    });
  }

  // Route by shape: a stripped 6-digit string is a TOTP attempt; anything
  // else falls through to backup-code verification (which is heavier — scrypt
  // per stored hash — so we avoid running it on TOTP-shaped input).
  const stripped = params.code.replace(/[\s-]+/g, "");
  let codeValid = false;

  if (TOTP_CODE_PATTERN.test(stripped) && user.totpSecret) {
    let plaintextSecret: string;
    try {
      plaintextSecret = decryptSecret(user.totpSecret);
    } catch (cause) {
      throw new TotpServiceError("Stored TOTP secret is unreadable", {
        code: "invalid_totp",
        statusCode: 400,
        cause,
      });
    }
    codeValid = verifyTotp(plaintextSecret, params.code);
  }

  if (!codeValid && user.totpBackupCodes) {
    let hashes: string[];
    try {
      const parsed: unknown = JSON.parse(decryptSecret(user.totpBackupCodes));
      if (
        !Array.isArray(parsed) ||
        !parsed.every((entry): entry is string => typeof entry === "string")
      ) {
        throw new Error("Backup-code blob is not a string array");
      }
      hashes = parsed;
    } catch (cause) {
      throw new TotpServiceError("Stored backup codes are unreadable", {
        code: "invalid_totp",
        statusCode: 400,
        cause,
      });
    }

    const result = await verifyBackupCode(hashes, params.code);
    if (result.matchedHash !== null) {
      codeValid = true;
    }
  }

  if (!codeValid) {
    throw new TotpServiceError("Invalid verification code", {
      code: "invalid_totp",
      statusCode: 400,
    });
  }

  await persistClearedTotp(user.id);
  // Revoke every session for this user. Disabling 2FA is a credential-grade
  // change; the caller proved current possession via TOTP/backup, and we
  // force a fresh login on every device so an old captured cookie can't ride
  // the disable. The route is responsible for clearing the caller's cookie.
  await deleteSessionsForUser(user.id);
  markTotpCodeUsed(user.id, params.code);

  return { enabled: false };
}

export type CompleteTotpLoginResult = {
  sessionToken: string;
  sessionExpiresAt: Date;
  user: { id: string; username: string };
};

/**
 * Finishes a two-step login: exchanges a valid partial-auth token + valid
 * TOTP (or unused backup) code for a real session cookie. On success a
 * session row is written, a session token is returned for the caller to
 * set as a cookie, and a consumed backup code (if that path was taken) is
 * pruned from the encrypted blob.
 *
 * Error mapping is intentionally narrow: every failure mode the caller can
 * surface to a user is 401, so an attacker probing this endpoint can't tell
 * whether they have the wrong token, the wrong code, or a stale enrolment.
 *
 * - 401 `partial_auth_expired` — token missing, malformed, tampered with,
 *   or past its 5-minute lifetime. Client must re-enter the password.
 * - 401 `invalid_totp` — token was valid but the code didn't match TOTP
 *   or any stored backup hash, was a replay, the stored ciphertext is
 *   unreadable, the user row vanished, or TOTP was disabled between A7
 *   and A8 (don't expose the state — the client should re-login).
 */
const BACKUP_CODE_CAS_RETRIES = 3;

function decodeBackupHashes(encrypted: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(decryptSecret(encrypted));
    if (
      !Array.isArray(parsed) ||
      !parsed.every((entry): entry is string => typeof entry === "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Removes `matchedHash` from the user's encrypted backup-codes blob using a
 * compare-and-swap UPDATE, retrying on contention. Returns true if a slot
 * was consumed; false means another concurrent login already burned this
 * same hash (so the caller must reject the attempt as invalid_totp).
 *
 * The CAS closes the race where two concurrent /login/totp calls with
 * different backup codes both read the same blob and write back interleaved
 * versions — without it the second writer would silently lose the first's
 * consumption and a single backup code could be used twice.
 */
async function consumeBackupCodeHash(
  userId: string,
  matchedHash: string,
  initialBlob: string,
): Promise<boolean> {
  let currentBlob = initialBlob;
  for (let attempt = 0; attempt < BACKUP_CODE_CAS_RETRIES; attempt++) {
    const hashes = decodeBackupHashes(currentBlob);
    if (hashes === null) return false;
    if (!hashes.includes(matchedHash)) {
      // Same backup code was just consumed by a concurrent login. We MUST
      // refuse — single-use means single-use.
      return false;
    }

    const remaining = hashes.filter((hash) => hash !== matchedHash);
    const ok = await updateTotpBackupCodes({
      userId,
      previousBackupCodes: currentBlob,
      nextBackupCodes: encryptSecret(JSON.stringify(remaining)),
    });
    if (ok) return true;

    // Lost the CAS to a different code's consumer. Reload and try once more.
    const fresh = await findUserWithTotpById(userId);
    if (!fresh || !fresh.totpEnabled || !fresh.totpBackupCodes) return false;
    currentBlob = fresh.totpBackupCodes;
  }
  return false;
}

/**
 * Internal core of {@link completeTotpLogin}. Encapsulated so the outer
 * function can wrap it in the brute-force + single-use guards and convert
 * every invalid_totp failure into a recorded attempt against the partial
 * token.
 */
async function attemptTotpLogin(params: {
  userId: string;
  code: string;
}): Promise<CompleteTotpLoginResult> {
  const user = await findUserWithTotpById(params.userId);
  if (!user || !user.totpEnabled || !user.totpSecret) {
    throw new TotpServiceError("Invalid verification code", {
      code: "invalid_totp",
      statusCode: 401,
    });
  }

  if (isTotpCodeReplayed(user.id, params.code)) {
    throw new TotpServiceError("Invalid verification code", {
      code: "invalid_totp",
      statusCode: 401,
    });
  }

  const stripped = params.code.replace(/[\s-]+/g, "");
  let codeValid = false;
  let consumedBackupHash: string | null = null;

  if (TOTP_CODE_PATTERN.test(stripped)) {
    let plaintextSecret: string;
    try {
      plaintextSecret = decryptSecret(user.totpSecret);
    } catch (cause) {
      throw new TotpServiceError("Stored TOTP secret is unreadable", {
        code: "invalid_totp",
        statusCode: 401,
        cause,
      });
    }
    codeValid = verifyTotp(plaintextSecret, params.code);
  }

  if (!codeValid && user.totpBackupCodes) {
    const hashes = decodeBackupHashes(user.totpBackupCodes);
    if (hashes === null) {
      throw new TotpServiceError("Stored backup codes are unreadable", {
        code: "invalid_totp",
        statusCode: 401,
      });
    }
    const result = await verifyBackupCode(hashes, params.code);
    if (result.matchedHash !== null) {
      codeValid = true;
      consumedBackupHash = result.matchedHash;
    }
  }

  if (!codeValid) {
    throw new TotpServiceError("Invalid verification code", {
      code: "invalid_totp",
      statusCode: 401,
    });
  }

  if (consumedBackupHash !== null && user.totpBackupCodes) {
    const consumed = await consumeBackupCodeHash(
      user.id,
      consumedBackupHash,
      user.totpBackupCodes,
    );
    if (!consumed) {
      throw new TotpServiceError("Invalid verification code", {
        code: "invalid_totp",
        statusCode: 401,
      });
    }
  }

  const sessionExpiresAt = new Date(
    Date.now() + serverEnv.AUTH_SESSION_HOURS * 60 * 60 * 1000,
  );
  const sessionId = randomUUID();
  await createSession({
    id: sessionId,
    userId: user.id,
    expiresAt: sessionExpiresAt,
  });

  const sessionToken = createSessionToken(
    sessionId,
    Math.floor(sessionExpiresAt.getTime() / 1000),
  );

  markTotpCodeUsed(user.id, params.code);

  return {
    sessionToken,
    sessionExpiresAt,
    user: { id: user.id, username: user.username },
  };
}

export async function completeTotpLogin(params: {
  partialAuthToken: string;
  code: string;
}): Promise<CompleteTotpLoginResult> {
  const verified = verifyPartialAuthToken(params.partialAuthToken);
  if (!verified) {
    throw new TotpServiceError("Partial-auth token is invalid or expired", {
      code: "partial_auth_expired",
      statusCode: 401,
    });
  }

  // Single-use: once a partial token has been redeemed for a real session,
  // refuse to redeem it again even if still cryptographically valid. Defends
  // against an attacker who captures the partial token within its 5-minute
  // TTL after the legitimate user has already completed login.
  if (isPartialAuthTokenConsumed(params.partialAuthToken)) {
    throw new TotpServiceError("Partial-auth token already used", {
      code: "partial_auth_consumed",
      statusCode: 401,
    });
  }

  // Brute-force gate: 5 wrong-code attempts against the same partial token
  // trip a 429 for the rest of the token's lifetime. We do NOT invalidate
  // the token (per the A8 spec — "allow retry until token expires"); we
  // throttle instead. Attempts that exceed the cap during the legitimate
  // user's window just force them to re-enter the password.
  if (isPartialAuthTokenBlocked(params.partialAuthToken)) {
    throw new TotpServiceError(
      "Too many failed two-factor attempts for this login session",
      { code: "too_many_attempts", statusCode: 429 },
    );
  }

  try {
    const result = await attemptTotpLogin({
      userId: verified.userId,
      code: params.code,
    });
    markPartialAuthTokenConsumed(
      params.partialAuthToken,
      verified.expiresAtEpochSeconds,
    );
    return result;
  } catch (error) {
    if (error instanceof TotpServiceError && error.code === "invalid_totp") {
      recordPartialAuthFailure(
        params.partialAuthToken,
        verified.expiresAtEpochSeconds,
      );
    }
    throw error;
  }
}
