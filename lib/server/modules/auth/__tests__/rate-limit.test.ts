import { afterEach, describe, expect, it } from "vitest";

import {
  _resetPartialAuthGuardsForTesting,
  _resetTotpReplayGuardForTesting,
  isPartialAuthTokenBlocked,
  isPartialAuthTokenConsumed,
  isTotpCodeReplayed,
  markPartialAuthTokenConsumed,
  markTotpCodeUsed,
  recordPartialAuthFailure,
} from "@/lib/server/modules/auth/rate-limit";

afterEach(() => {
  _resetTotpReplayGuardForTesting();
  _resetPartialAuthGuardsForTesting();
});

describe("totp replay guard", () => {
  it("returns false before any code has been marked used", () => {
    expect(isTotpCodeReplayed("user-1", "123456")).toBe(false);
  });

  it("returns true when the exact same code is replayed within the window", () => {
    markTotpCodeUsed("user-1", "123456", 1_000);
    expect(isTotpCodeReplayed("user-1", "123456", 1_500)).toBe(true);
  });

  it("returns false for a different code from the same user", () => {
    markTotpCodeUsed("user-1", "123456", 1_000);
    expect(isTotpCodeReplayed("user-1", "654321", 1_500)).toBe(false);
  });

  it("isolates the guard per user", () => {
    markTotpCodeUsed("user-1", "123456", 1_000);
    expect(isTotpCodeReplayed("user-2", "123456", 1_500)).toBe(false);
  });

  it("expires the record after its TTL elapses", () => {
    markTotpCodeUsed("user-1", "123456", 1_000);
    // 120 s TTL → record valid through 121_000 but not at 1_000 + 120_001.
    expect(isTotpCodeReplayed("user-1", "123456", 121_001)).toBe(false);
    // Calling once with an expired record should also drop it from memory.
    expect(isTotpCodeReplayed("user-1", "123456", 121_001)).toBe(false);
  });

  it("replacing the stored code with a newer one moves the window forward", () => {
    markTotpCodeUsed("user-1", "111111", 1_000);
    markTotpCodeUsed("user-1", "222222", 30_000);

    // Old code is no longer the "last used" — replay check should miss.
    expect(isTotpCodeReplayed("user-1", "111111", 30_500)).toBe(false);
    expect(isTotpCodeReplayed("user-1", "222222", 30_500)).toBe(true);
  });
});

describe("partial-auth brute-force guard", () => {
  const TOKEN = "partial.user-1.future.sig";
  // Pick an explicit `now` and a token expiry several minutes into its
  // future so we exercise the failure-count threshold without the
  // "record expired" path tripping.
  const NOW_MS = 1_000_000_000_000;
  const TOKEN_EXP_SECONDS = Math.floor(NOW_MS / 1000) + 5 * 60;

  it("returns false before any failures are recorded", () => {
    expect(isPartialAuthTokenBlocked(TOKEN, NOW_MS)).toBe(false);
  });

  it("trips at the 5th failure for the same token", () => {
    for (let i = 0; i < 4; i++) {
      recordPartialAuthFailure(TOKEN, TOKEN_EXP_SECONDS, NOW_MS);
    }
    expect(isPartialAuthTokenBlocked(TOKEN, NOW_MS)).toBe(false);

    recordPartialAuthFailure(TOKEN, TOKEN_EXP_SECONDS, NOW_MS);
    expect(isPartialAuthTokenBlocked(TOKEN, NOW_MS)).toBe(true);
  });

  it("isolates the guard per token (different raw tokens cannot pool)", () => {
    for (let i = 0; i < 5; i++) {
      recordPartialAuthFailure(TOKEN, TOKEN_EXP_SECONDS, NOW_MS);
    }
    expect(isPartialAuthTokenBlocked(TOKEN, NOW_MS)).toBe(true);
    expect(
      isPartialAuthTokenBlocked("partial.other.future.sig", NOW_MS),
    ).toBe(false);
  });

  it("self-evicts once the token's own expiry has passed", () => {
    for (let i = 0; i < 5; i++) {
      recordPartialAuthFailure(TOKEN, TOKEN_EXP_SECONDS, NOW_MS);
    }
    expect(isPartialAuthTokenBlocked(TOKEN, NOW_MS)).toBe(true);

    // After expiry + buffer: the read-path sweep drops the record and the
    // block disappears. Real-world equivalent: token has expired anyway, so
    // the caller would already see partial_auth_expired before this check.
    const wellPastExpiry = TOKEN_EXP_SECONDS * 1000 + 60_000;
    expect(isPartialAuthTokenBlocked(TOKEN, wellPastExpiry)).toBe(false);
  });
});

describe("partial-auth single-use guard", () => {
  const TOKEN = "partial.user-1.future.sig";
  // Use a real "near-future" epoch for these tests since they don't pass an
  // explicit `now` and the default Date.now() must not have already passed
  // the token's expiry.
  const TOKEN_EXP_SECONDS = Math.floor(Date.now() / 1000) + 60 * 60;

  it("returns false before the token has been consumed", () => {
    expect(isPartialAuthTokenConsumed(TOKEN)).toBe(false);
  });

  it("returns true after markPartialAuthTokenConsumed", () => {
    markPartialAuthTokenConsumed(TOKEN, TOKEN_EXP_SECONDS);
    expect(isPartialAuthTokenConsumed(TOKEN)).toBe(true);
  });

  it("isolates per token", () => {
    markPartialAuthTokenConsumed(TOKEN, TOKEN_EXP_SECONDS);
    expect(isPartialAuthTokenConsumed("partial.other.future.sig")).toBe(false);
  });

  it("clears once the token's own expiry has passed", () => {
    markPartialAuthTokenConsumed(TOKEN, TOKEN_EXP_SECONDS);
    expect(isPartialAuthTokenConsumed(TOKEN)).toBe(true);

    const wellPastExpiry = TOKEN_EXP_SECONDS * 1000 + 60_000;
    expect(isPartialAuthTokenConsumed(TOKEN, wellPastExpiry)).toBe(false);
  });
});
