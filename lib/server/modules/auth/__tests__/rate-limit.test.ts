import { afterEach, describe, expect, it } from "vitest";

import {
  _resetTotpReplayGuardForTesting,
  isTotpCodeReplayed,
  markTotpCodeUsed,
} from "@/lib/server/modules/auth/rate-limit";

afterEach(() => {
  _resetTotpReplayGuardForTesting();
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
