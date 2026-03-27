import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/update-service", () => ({
  scheduleSystemUpdate: vi.fn(),
}));

import { POST } from "@/app/api/v1/system/updates/apply/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { scheduleSystemUpdate } from "@/lib/server/modules/system/update-service";

describe("POST /api/v1/system/updates/apply", () => {
  it("returns 202 and schedules a Homeio update for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(scheduleSystemUpdate).mockResolvedValueOnce({
      action: "update",
      accepted: true,
    });

    const response = await POST(
      new NextRequest("http://localhost/api/v1/system/updates/apply", {
        method: "POST",
        headers: { cookie: "homeio_session=session-token" },
      }),
    );
    const json = (await response.json()) as { data: { action: string; accepted: boolean } };

    expect(response.status).toBe(202);
    expect(json.data).toEqual({ action: "update", accepted: true });
  });

  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const response = await POST(
      new NextRequest("http://localhost/api/v1/system/updates/apply", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(401);
  });
});
