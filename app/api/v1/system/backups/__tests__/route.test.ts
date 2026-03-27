import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/backup-service", () => ({
  getSystemBackupsSnapshot: vi.fn(),
}));

import { GET } from "@/app/api/v1/system/backups/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { getSystemBackupsSnapshot } from "@/lib/server/modules/system/backup-service";

describe("GET /api/v1/system/backups", () => {
  it("returns backups snapshot for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(getSystemBackupsSnapshot).mockResolvedValueOnce({
      settings: {
        enabled: false,
        frequency: "weekly",
        dayOfWeek: "sunday",
        time: "03:00",
        retentionCount: 7,
      },
      backups: [],
      backupRoot: "/DATA/Backups/homeio",
    });

    const request = new NextRequest("http://localhost/api/v1/system/backups", {
      headers: {
        cookie: "homeio_session=session-token",
      },
    });

    const response = await GET(request);
    const json = (await response.json()) as { data: { backupRoot: string } };

    expect(response.status).toBe(200);
    expect(json.data.backupRoot).toBe("/DATA/Backups/homeio");
  });

  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const response = await GET(new NextRequest("http://localhost/api/v1/system/backups"));

    expect(response.status).toBe(401);
    expect(getSystemBackupsSnapshot).not.toHaveBeenCalled();
  });
});
