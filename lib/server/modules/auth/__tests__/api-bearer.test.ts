import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAuthenticateSession, mockFindByPrefix, mockTouch } = vi.hoisted(() => ({
  mockAuthenticateSession: vi.fn(),
  mockFindByPrefix: vi.fn(),
  mockTouch: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: mockAuthenticateSession,
}));
vi.mock("@/lib/server/modules/auth/api-token-repository", () => ({
  findApiTokenByPrefix: mockFindByPrefix,
  touchApiToken: mockTouch,
}));

// The real module is mocked globally in test/setup.ts; this suite tests it.
vi.unmock("@/lib/server/modules/auth/api");

import { requireApiSession } from "@/lib/server/modules/auth/api";
import { hashToken } from "@/lib/server/modules/auth/api-token-service";

const TOKEN = "homeio_abcdefghijklmnopqrstuvwxyz012345";

function req(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/system/metrics", { headers });
}

async function storedToken(overrides: Record<string, unknown> = {}) {
  return {
    id: "tok_1",
    name: "Home Assistant",
    prefix: TOKEN.slice(0, 15),
    scopes: ["read:metrics"],
    expiresAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
    tokenHash: await hashToken(TOKEN),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthenticateSession.mockResolvedValue(null);
  mockTouch.mockResolvedValue(undefined);
  // Reset queued one-shot values too: clearAllMocks keeps them, and an
  // unconsumed one would answer the next test's lookup.
  mockFindByPrefix.mockReset();
});

describe("requireApiSession — the session path is unchanged", () => {
  it("accepts a session cookie without consulting tokens", async () => {
    mockAuthenticateSession.mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "h",
      expiresAt: new Date(),
    });

    const result = await requireApiSession(req({ cookie: "homeio_session=t" }));

    expect(result.response).toBeNull();
    expect(mockFindByPrefix).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated request as before", async () => {
    const result = await requireApiSession(req());

    expect(result.response?.status).toBe(401);
  });
});

describe("requireApiSession — bearer tokens", () => {
  it("refuses a token on a route that declares no scope", async () => {
    // Default-deny: adding token support must not open endpoints nobody
    // reviewed. A route opts in by naming the scope it needs.
    // No mock is queued deliberately — the lookup must never be reached, and a
    // queued value would leak into the next test.
    const result = await requireApiSession(req({ authorization: `Bearer ${TOKEN}` }));

    expect(result.response?.status).toBe(401);
    expect(mockFindByPrefix).not.toHaveBeenCalled();
  });

  it("accepts a token carrying the scope the route asked for", async () => {
    mockFindByPrefix.mockResolvedValueOnce(await storedToken());

    const result = await requireApiSession(req({ authorization: `Bearer ${TOKEN}` }), {
      scope: "read:metrics",
    });

    expect(result.response).toBeNull();
    expect(result.session?.username).toBe("Home Assistant");
  });

  it("answers 403, not 401, when the token lacks the scope", async () => {
    // The credential is real; a 401 would send the client into a re-auth loop.
    mockFindByPrefix.mockResolvedValueOnce(await storedToken({ scopes: ["read:apps"] }));

    const result = await requireApiSession(req({ authorization: `Bearer ${TOKEN}` }), {
      scope: "system:power",
    });

    expect(result.response?.status).toBe(403);
  });

  it("refuses a revoked token", async () => {
    mockFindByPrefix.mockResolvedValueOnce(
      await storedToken({ revokedAt: new Date().toISOString() }),
    );

    const result = await requireApiSession(req({ authorization: `Bearer ${TOKEN}` }), {
      scope: "read:metrics",
    });

    expect(result.response?.status).toBe(401);
  });

  it("refuses an expired token", async () => {
    mockFindByPrefix.mockResolvedValueOnce(
      await storedToken({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );

    const result = await requireApiSession(req({ authorization: `Bearer ${TOKEN}` }), {
      scope: "read:metrics",
    });

    expect(result.response?.status).toBe(401);
  });

  it("refuses a token whose secret does not match the stored hash", async () => {
    mockFindByPrefix.mockResolvedValueOnce(await storedToken());

    const result = await requireApiSession(
      req({ authorization: "Bearer homeio_abcdefghWRONGWRONGWRONGWRONG12345" }),
      { scope: "read:metrics" },
    );

    expect(result.response?.status).toBe(401);
  });

  it("refuses an unknown prefix", async () => {
    mockFindByPrefix.mockResolvedValueOnce(null);

    const result = await requireApiSession(req({ authorization: `Bearer ${TOKEN}` }), {
      scope: "read:metrics",
    });

    expect(result.response?.status).toBe(401);
  });

  it("ignores an Authorization header that is not a bearer", async () => {
    const result = await requireApiSession(req({ authorization: "Basic abc123" }), {
      scope: "read:metrics",
    });

    expect(result.response?.status).toBe(401);
    expect(mockFindByPrefix).not.toHaveBeenCalled();
  });

  it("records when and from where a token was used", async () => {
    mockFindByPrefix.mockResolvedValueOnce(await storedToken());

    await requireApiSession(
      req({ authorization: `Bearer ${TOKEN}`, "x-forwarded-for": "192.168.1.50, 10.0.0.1" }),
      { scope: "read:metrics" },
    );

    expect(mockTouch).toHaveBeenCalledWith("tok_1", "192.168.1.50");
  });

  it("does not fail the request when the usage stamp fails", async () => {
    mockFindByPrefix.mockResolvedValueOnce(await storedToken());
    mockTouch.mockRejectedValueOnce(new Error("db down"));

    const result = await requireApiSession(req({ authorization: `Bearer ${TOKEN}` }), {
      scope: "read:metrics",
    });

    expect(result.response).toBeNull();
  });
});
