import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/repository", () => ({
  createSession: vi.fn(),
  createUser: vi.fn(),
  deleteSessionById: vi.fn(),
  findSessionWithUser: vi.fn(),
  findUserByUsername: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/password", () => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/session-token", () => ({
  createSessionToken: vi.fn(),
  verifySessionToken: vi.fn(),
}));

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    AUTH_PRIMARY_USERNAME: "admin",
    AUTH_SESSION_HOURS: 168,
  },
}));

import {
  createSession,
  createUser,
  deleteSessionById,
  findSessionWithUser,
  findUserByUsername,
} from "@/lib/server/modules/auth/repository";
import { hashPassword, verifyPassword } from "@/lib/server/modules/auth/password";
import {
  createSessionToken,
  verifySessionToken,
} from "@/lib/server/modules/auth/session-token";
import {
  AuthError,
  authenticateSession,
  loginUser,
  logoutSession,
  registerUser,
  verifyUnlockPassword,
} from "@/lib/server/modules/auth/service";

describe("auth service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a user", async () => {
    vi.mocked(findUserByUsername).mockResolvedValueOnce(null);
    vi.mocked(hashPassword).mockResolvedValueOnce("salt:hash");

    const result = await registerUser({
      username: "admin",
      password: "StrongPass123",
      confirmPassword: "StrongPass123",
    });

    expect(result.username).toBe("admin");
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it("fails registration when passwords mismatch", async () => {
    await expect(
      registerUser({
        username: "admin",
        password: "StrongPass123",
        confirmPassword: "WrongPass123",
      }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("logs in user and creates session token", async () => {
    vi.mocked(findUserByUsername).mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      passwordHash: "salt:hash",
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);
    vi.mocked(createSessionToken).mockReturnValueOnce("token-123");

    const result = await loginUser({
      username: "admin",
      password: "StrongPass123",
    });

    expect(result.token).toBe("token-123");
    expect(createSession).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid login", async () => {
    vi.mocked(findUserByUsername).mockResolvedValueOnce({
      id: "u1",
      username: "admin",
      passwordHash: "salt:hash",
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    await expect(
      loginUser({ username: "admin", password: "bad-pass" }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("authenticates a valid session token", async () => {
    vi.mocked(verifySessionToken).mockReturnValueOnce({
      sessionId: "s1",
      expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 3600,
    });
    vi.mocked(findSessionWithUser).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "admin",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const session = await authenticateSession("token-123");

    expect(session?.username).toBe("admin");
  });

  it("logs out by deleting session", async () => {
    vi.mocked(verifySessionToken).mockReturnValueOnce({
      sessionId: "s1",
      expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 3600,
    });

    await logoutSession("token-123");

    expect(deleteSessionById).toHaveBeenCalledWith("s1");
  });

  it("verifies unlock password", async () => {
    vi.mocked(verifySessionToken).mockReturnValueOnce({
      sessionId: "s1",
      expiresAtEpochSeconds: Math.floor(Date.now() / 1000) + 3600,
    });
    vi.mocked(findSessionWithUser).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "admin",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 3600_000),
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const unlocked = await verifyUnlockPassword({
      sessionToken: "token-123",
      password: "StrongPass123",
    });

    expect(unlocked.username).toBe("admin");
  });
});
