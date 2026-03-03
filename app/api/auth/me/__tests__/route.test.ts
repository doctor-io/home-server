import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

import { GET } from "@/app/api/auth/me/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";

describe("GET /api/auth/me", () => {
  it("returns current user when session is valid", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "admin",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const request = new NextRequest("http://localhost/api/auth/me", {
      headers: {
        cookie: "homeio_session=session-token",
      },
    });

    const response = await GET(request);
    const json = (await response.json()) as { data: { username: string } };

    expect(response.status).toBe(200);
    expect(json.data.username).toBe("admin");
  });

  it("returns unauthorized when session is missing", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/api/auth/me");

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
