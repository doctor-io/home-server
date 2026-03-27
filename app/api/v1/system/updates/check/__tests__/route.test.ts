import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/update-service", () => ({
  getSystemUpdateStatus: vi.fn(),
}));

import { POST } from "@/app/api/v1/system/updates/check/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { getSystemUpdateStatus } from "@/lib/server/modules/system/update-service";

describe("POST /api/v1/system/updates/check", () => {
  it("checks Homeio updates for authenticated users", async () => {
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

    const response = await POST(
      new NextRequest("http://localhost/api/v1/system/updates/check", {
        method: "POST",
        headers: { cookie: "homeio_session=session-token" },
      }),
    );
    const json = (await response.json()) as { data: { latestVersion: string | null } };

    expect(response.status).toBe(200);
    expect(json.data.latestVersion).toBe("0.1.75");
  });

  it("returns 500 when the update check fails", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(getSystemUpdateStatus).mockRejectedValueOnce(new Error("fetch failed"));

    const response = await POST(
      new NextRequest("http://localhost/api/v1/system/updates/check", {
        method: "POST",
        headers: { cookie: "homeio_session=session-token" },
      }),
    );
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to check for Homeio updates");
  });
});
