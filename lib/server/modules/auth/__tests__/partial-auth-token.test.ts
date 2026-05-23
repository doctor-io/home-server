import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_SECRET = "a-very-long-secret-for-tests";

async function loadModule() {
  vi.resetModules();
  vi.doMock("@/lib/server/env", () => ({
    serverEnv: { AUTH_SESSION_SECRET: TEST_SECRET },
  }));
  return await import("@/lib/server/modules/auth/partial-auth-token");
}

describe("partial-auth token", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
  });

  it("creates and verifies a valid token", async () => {
    const { createPartialAuthToken, verifyPartialAuthToken } =
      await loadModule();

    const { token, expiresAtEpochSeconds } =
      createPartialAuthToken("user-1");

    expect(token.startsWith("partial.user-1.")).toBe(true);
    expect(token.split(".").length).toBe(4);

    expect(verifyPartialAuthToken(token)).toEqual({
      userId: "user-1",
      expiresAtEpochSeconds,
    });
  });

  it("expires after PARTIAL_AUTH_TOKEN_TTL_SECONDS", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-23T00:00:00.000Z"));

    const { createPartialAuthToken, verifyPartialAuthToken } =
      await loadModule();
    const { token } = createPartialAuthToken("user-1");

    expect(verifyPartialAuthToken(token)).not.toBeNull();

    // 5 minutes + 1 second past issuance — token should be rejected.
    vi.setSystemTime(new Date("2026-05-23T00:05:01.000Z"));
    expect(verifyPartialAuthToken(token)).toBeNull();
  });

  it("rejects a tampered signature", async () => {
    const { createPartialAuthToken, verifyPartialAuthToken } =
      await loadModule();
    const { token } = createPartialAuthToken("user-1");

    const [prefix, userId, exp, sig] = token.split(".");
    const flipped = sig.startsWith("a")
      ? "b" + sig.slice(1)
      : "a" + sig.slice(1);
    const tampered = [prefix, userId, exp, flipped].join(".");

    expect(verifyPartialAuthToken(tampered)).toBeNull();
  });

  it("rejects a token whose userId field was swapped after signing", async () => {
    const { createPartialAuthToken, verifyPartialAuthToken } =
      await loadModule();
    const { token } = createPartialAuthToken("user-1");

    const [, , exp, sig] = token.split(".");
    const swapped = ["partial", "user-2", exp, sig].join(".");

    expect(verifyPartialAuthToken(swapped)).toBeNull();
  });

  it("does not accept a session-token-shaped value as a partial-auth token", async () => {
    // Build a token whose signed payload looks like a session token's signed
    // payload. Even with the same secret, the verifier should fail because
    // the `partial.` prefix isn't in the signed bytes.
    const { createHmac } = await import("node:crypto");
    const { verifyPartialAuthToken } = await loadModule();

    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const sessionPayload = `session-id.${expiresAt}`;
    const sig = createHmac("sha256", TEST_SECRET)
      .update(sessionPayload)
      .digest("hex");

    // Format the malicious token as 4 segments so the parser at least
    // proceeds to the signature check.
    expect(
      verifyPartialAuthToken(`partial.session-id.${expiresAt}.${sig}`),
    ).toBeNull();
  });

  it("returns null for malformed tokens without throwing", async () => {
    const { verifyPartialAuthToken } = await loadModule();
    expect(verifyPartialAuthToken("garbage")).toBeNull();
    expect(verifyPartialAuthToken("a.b.c")).toBeNull();
    expect(verifyPartialAuthToken("")).toBeNull();
  });
});
