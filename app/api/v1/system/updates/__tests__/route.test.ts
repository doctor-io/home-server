import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/update-service", () => ({
  getSystemUpdateStatus: vi.fn(),
}));

import { GET } from "@/app/api/v1/system/updates/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { getSystemUpdateStatus } from "@/lib/server/modules/system/update-service";

describe("GET /api/v1/system/updates", () => {
  it("returns Homeio update status for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(getSystemUpdateStatus).mockResolvedValueOnce({
      currentVersion: "0.1.74",
      latestVersion: "0.1.75",
      updateAvailable: true,
      checkedAt: "2026-03-08T10:00:00.000Z",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/system/updates", {
        headers: { cookie: "homeio_session=session-token" },
      }),
    );
    const json = (await response.json()) as { data: { currentVersion: string } };

    expect(response.status).toBe(200);
    expect(json.data.currentVersion).toBe("0.1.74");
  });

  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const response = await GET(new NextRequest("http://localhost/api/v1/system/updates"));

    expect(response.status).toBe(401);
  });
});
