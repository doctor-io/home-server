import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireApiSession, mockFind, mockSave } = vi.hoisted(() => ({
  mockRequireApiSession: vi.fn(),
  mockFind: vi.fn(),
  mockSave: vi.fn(),
}));

vi.mock("@/lib/server/modules/auth/api", async () => {
  const { NextResponse: Res } = await import("next/server");
  return {
    requireApiSession: mockRequireApiSession,
    unauthorizedApiResponse: () => Res.json({ error: "Unauthorized" }, { status: 401 }),
  };
});

vi.mock("@/lib/server/modules/apps/health-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/modules/apps/health-repository")
  >("@/lib/server/modules/apps/health-repository");
  return {
    defaultHealth: actual.defaultHealth,
    findAppHealth: mockFind,
    saveAppHealthPolicy: mockSave,
  };
});

import { GET, PUT } from "@/app/api/v1/apps/[appId]/health/route";

function ctx(appId = "jellyfin") {
  return { params: Promise.resolve({ appId }) };
}

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/v1/apps/jellyfin/health", {
    ...(body === undefined ? { method: "GET" } : { method: "PUT", body: JSON.stringify(body) }),
    headers: { cookie: "homeio_session=t" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireApiSession.mockResolvedValue({
    session: { sessionId: "s", userId: "u", username: "a", passwordHash: "h", expiresAt: new Date() },
    response: null,
  });
});

describe("GET /api/v1/apps/[appId]/health", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockRequireApiSession.mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await GET(req(), ctx())).status).toBe(401);
  });

  it("reports the default policy for an app that was never configured", async () => {
    // No row is not an error — it means "leave this container alone".
    mockFind.mockResolvedValueOnce(null);

    const json = (await (await GET(req(), ctx())).json()) as { data: { policy: string } };

    expect(json.data).toMatchObject({ appId: "jellyfin", policy: "no", state: "unknown" });
  });

  it("returns the stored policy and counters", async () => {
    mockFind.mockResolvedValueOnce({
      appId: "jellyfin",
      policy: "on-failure",
      maxRestarts: 3,
      windowMinutes: 10,
      state: "restarting",
      restartCount: 2,
      windowStartedAt: null,
      lastTransitionAt: null,
      mutedUntil: null,
    });

    const json = (await (await GET(req(), ctx())).json()) as { data: { policy: string } };

    expect(json.data.policy).toBe("on-failure");
  });
});

describe("PUT /api/v1/apps/[appId]/health", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockRequireApiSession.mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await PUT(req({ policy: "always" }), ctx())).status).toBe(401);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("rejects a policy Docker does not define", async () => {
    const response = await PUT(req({ policy: "sometimes" }), ctx());

    expect(response.status).toBe(400);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("rejects a restart budget outside sane bounds", async () => {
    expect((await PUT(req({ policy: "always", maxRestarts: 0 }), ctx())).status).toBe(400);
    expect((await PUT(req({ policy: "always", windowMinutes: 5000 }), ctx())).status).toBe(400);
  });

  it("accepts each policy Docker defines", async () => {
    mockFind.mockResolvedValue(null);

    for (const policy of ["no", "on-failure", "always", "unless-stopped"]) {
      const response = await PUT(req({ policy }), ctx());
      expect(response.status).toBe(200);
    }

    expect(mockSave).toHaveBeenCalledTimes(4);
  });

  it("stores the budget alongside the policy", async () => {
    mockFind.mockResolvedValueOnce(null);

    await PUT(req({ policy: "on-failure", maxRestarts: 3, windowMinutes: 15 }), ctx());

    expect(mockSave).toHaveBeenCalledWith("jellyfin", {
      policy: "on-failure",
      maxRestarts: 3,
      windowMinutes: 15,
    });
  });

  it("accepts an explicit null to clear a mute", async () => {
    mockFind.mockResolvedValueOnce(null);

    await PUT(req({ policy: "always", mutedUntil: null }), ctx());

    expect(mockSave).toHaveBeenCalledWith(
      "jellyfin",
      expect.objectContaining({ mutedUntil: null }),
    );
  });
});
