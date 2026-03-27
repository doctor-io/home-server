import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/backup-service", () => ({
  updateSystemBackupSettings: vi.fn(),
}));

import { PUT } from "@/app/api/v1/system/backups/settings/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { updateSystemBackupSettings } from "@/lib/server/modules/system/backup-service";

describe("PUT /api/v1/system/backups/settings", () => {
  it("updates backup settings for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(updateSystemBackupSettings).mockResolvedValueOnce({
      enabled: true,
      frequency: "daily",
      dayOfWeek: "monday",
      time: "02:30",
      retentionCount: 14,
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/backups/settings", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          enabled: true,
          frequency: "daily",
          dayOfWeek: "monday",
          time: "02:30",
          retentionCount: 14,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(updateSystemBackupSettings).toHaveBeenCalledWith({
      enabled: true,
      frequency: "daily",
      dayOfWeek: "monday",
      time: "02:30",
      retentionCount: 14,
    });
  });

  it("returns 400 for invalid payloads", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/backups/settings", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ enabled: true }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
