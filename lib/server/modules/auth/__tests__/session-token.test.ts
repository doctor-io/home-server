import { beforeEach, describe, expect, it, vi } from "vitest";

describe("session token", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("creates and verifies a valid token", async () => {
    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        AUTH_SESSION_SECRET: "a-very-long-secret-for-tests",
      },
    }));

    const { createSessionToken, verifySessionToken } = await import(
      "@/lib/server/modules/auth/session-token"
    );

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const token = createSessionToken("session-123", expiresAt);

    expect(verifySessionToken(token)).toEqual({
      sessionId: "session-123",
      expiresAtEpochSeconds: expiresAt,
    });
  });

  it("rejects tampered token", async () => {
    vi.doMock("@/lib/server/env", () => ({
      serverEnv: {
        AUTH_SESSION_SECRET: "a-very-long-secret-for-tests",
      },
    }));

    const { createSessionToken, verifySessionToken } = await import(
      "@/lib/server/modules/auth/session-token"
    );

    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const token = createSessionToken("session-123", expiresAt);

    expect(verifySessionToken(`${token}tampered`)).toBeNull();
  });
});
