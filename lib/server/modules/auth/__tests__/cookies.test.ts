import { beforeEach, describe, expect, it, vi } from "vitest";

describe("auth cookies", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses secure=false when AUTH_COOKIE_SECURE is disabled", async () => {
    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        AUTH_COOKIE_SECURE: false,
      },
    }));

    const { getSessionCookieOptions, getExpiredSessionCookieOptions } =
      await import("@/lib/server/modules/auth/cookies");

    expect(
      getSessionCookieOptions(new Date(Date.now() + 1_000)).secure,
    ).toBe(false);
    expect(getExpiredSessionCookieOptions().secure).toBe(false);
  });

  it("uses secure=true when AUTH_COOKIE_SECURE is enabled", async () => {
    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        AUTH_COOKIE_SECURE: true,
      },
    }));

    const { getSessionCookieOptions, getExpiredSessionCookieOptions } =
      await import("@/lib/server/modules/auth/cookies");

    expect(
      getSessionCookieOptions(new Date(Date.now() + 1_000)).secure,
    ).toBe(true);
    expect(getExpiredSessionCookieOptions().secure).toBe(true);
  });
});
