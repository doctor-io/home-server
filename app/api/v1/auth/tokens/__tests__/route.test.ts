import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireApiSession, mockList, mockCreate, mockRevoke } = vi.hoisted(() => ({
  mockRequireApiSession: vi.fn(),
  mockList: vi.fn(),
  mockCreate: vi.fn(),
  mockRevoke: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/api", async () => {
  const { NextResponse: Res } = await import("next/server");
  return {
    requireApiSession: mockRequireApiSession,
    unauthorizedApiResponse: () => Res.json({ error: "Unauthorized" }, { status: 401 }),
  };
});

vi.mock("@/lib/server/modules/auth/api-token-repository", () => ({
  listApiTokens: mockList,
  createApiToken: mockCreate,
  revokeApiToken: mockRevoke,
}));

import { GET, POST } from "@/app/api/v1/auth/tokens/route";
import { DELETE } from "@/app/api/v1/auth/tokens/[tokenId]/route";

function req(body?: unknown, method = body === undefined ? "GET" : "POST") {
  return new NextRequest("http://localhost/api/v1/auth/tokens", {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { cookie: "homeio_session=t" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiSession.mockResolvedValue({
    session: { sessionId: "s", userId: "u", username: "a", passwordHash: "h", expiresAt: new Date() },
    response: null,
  });
  mockCreate.mockImplementation(async (input: Record<string, unknown>) => ({
    id: input.id,
    name: input.name,
    prefix: input.prefix,
    scopes: input.scopes,
    expiresAt: null,
    lastUsedAt: null,
    lastUsedIp: null,
    createdAt: new Date().toISOString(),
    revokedAt: null,
  }));
});

describe("token management is session-only", () => {
  it("never declares a scope, so a token cannot mint another token", async () => {
    await GET(req());
    await POST(req({ name: "x", scopes: ["read:apps"] }));
    await DELETE(req(undefined, "DELETE"), { params: Promise.resolve({ tokenId: "t1" }) });

    // Every call passes exactly one argument: no scope option means bearer
    // auth is refused outright by requireApiSession.
    for (const call of mockRequireApiSession.mock.calls) {
      expect(call).toHaveLength(1);
    }
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireApiSession.mockResolvedValue({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await GET(req())).status).toBe(401);
    expect((await POST(req({ name: "x", scopes: ["read:apps"] }))).status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/auth/tokens", () => {
  it("returns the token value exactly once, at creation", async () => {
    const response = await POST(req({ name: "Home Assistant", scopes: ["read:metrics"] }));
    const json = (await response.json()) as { data: { token: string; prefix: string } };

    expect(response.status).toBe(201);
    expect(json.data.token.startsWith("homeio_")).toBe(true);
    expect(json.data.token.startsWith(json.data.prefix)).toBe(true);
  });

  it("stores a hash rather than the token", async () => {
    await POST(req({ name: "Home Assistant", scopes: ["read:metrics"] }));

    const stored = mockCreate.mock.calls[0][0] as Record<string, string>;
    expect(stored.tokenHash).toBeTruthy();
    expect(stored).not.toHaveProperty("token");
  });

  it("refuses a token with no scopes", async () => {
    // A credential that grants nothing is a footgun, not a feature.
    expect((await POST(req({ name: "x", scopes: [] }))).status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuses a scope that does not exist", async () => {
    expect((await POST(req({ name: "x", scopes: ["root:everything"] }))).status).toBe(400);
  });

  it("refuses an unnamed token", async () => {
    expect((await POST(req({ scopes: ["read:apps"] }))).status).toBe(400);
  });
});

describe("GET /api/v1/auth/tokens", () => {
  it("lists tokens without any hash", async () => {
    mockList.mockResolvedValueOnce([
      {
        id: "t1",
        name: "Home Assistant",
        prefix: "homeio_ab",
        scopes: ["read:metrics"],
        expiresAt: null,
        lastUsedAt: null,
        lastUsedIp: null,
        createdAt: new Date().toISOString(),
        revokedAt: null,
      },
    ]);

    const json = (await (await GET(req())).json()) as { data: Record<string, unknown>[] };

    expect(json.data).toHaveLength(1);
    expect(json.data[0]).not.toHaveProperty("tokenHash");
  });
});

describe("DELETE /api/v1/auth/tokens/[tokenId]", () => {
  it("revokes a token", async () => {
    mockRevoke.mockResolvedValueOnce(true);

    const response = await DELETE(req(undefined, "DELETE"), {
      params: Promise.resolve({ tokenId: "t1" }),
    });

    expect(response.status).toBe(200);
    expect(mockRevoke).toHaveBeenCalledWith("t1");
  });

  it("404s for a token that does not exist", async () => {
    mockRevoke.mockResolvedValueOnce(false);

    const response = await DELETE(req(undefined, "DELETE"), {
      params: Promise.resolve({ tokenId: "nope" }),
    });

    expect(response.status).toBe(404);
  });
});
