import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

const getEntitlementsSnapshot = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/modules/licensing/entitlements-service", () => ({
  getEntitlementsSnapshot,
}));

import { GET } from "@/app/api/v1/licensing/entitlements/route";
import { requireApiSession } from "@/lib/server/modules/auth/api";

const request = () =>
  new Request("http://localhost/api/v1/licensing/entitlements");

describe("GET /api/v1/licensing/entitlements", () => {
  it("returns the snapshot and forbids caching it", async () => {
    getEntitlementsSnapshot.mockReturnValueOnce({
      status: "active",
      plan: "pro",
      entitlements: ["multi-server"],
      licensedTo: "Ada Lovelace",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      data: {
        status: "active",
        plan: "pro",
        entitlements: ["multi-server"],
        licensedTo: "Ada Lovelace",
        expiresAt: "2027-01-01T00:00:00.000Z",
      },
    });
  });

  it("never returns the licence token itself", async () => {
    getEntitlementsSnapshot.mockReturnValueOnce({
      status: "active",
      plan: "pro",
      entitlements: [],
      licensedTo: "Ada Lovelace",
      expiresAt: null,
    });

    const body = await (await GET(request())).text();

    expect(body).not.toContain("HOMEIO_LICENSE");
    expect(body).not.toContain("token");
  });

  it("returns 401 for an unauthenticated caller", async () => {
    vi.mocked(requireApiSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    expect((await GET(request())).status).toBe(401);
  });
});
