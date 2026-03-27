import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/power-schedule", () => ({
  deleteScheduledRebootArtifacts: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/power-service", () => ({
  deleteFactoryResetArtifacts: vi.fn(),
  scheduleFactoryReset: vi.fn(),
}));

import { POST } from "@/app/api/v1/system/power/factory-reset/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { deleteScheduledRebootArtifacts } from "@/lib/server/modules/system/power-schedule";
import {
  deleteFactoryResetArtifacts,
  scheduleFactoryReset,
} from "@/lib/server/modules/system/power-service";

describe("POST /api/v1/system/power/factory-reset", () => {
  it("returns 202 and schedules factory reset for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(deleteScheduledRebootArtifacts).mockResolvedValueOnce(undefined);
    vi.mocked(deleteFactoryResetArtifacts).mockResolvedValueOnce(undefined);
    vi.mocked(scheduleFactoryReset).mockResolvedValueOnce(undefined);

    const request = new NextRequest("http://localhost/api/v1/system/power/factory-reset", {
      method: "POST",
      headers: {
        cookie: "homeio_session=session-token",
      },
    });

    const response = await POST(request);
    const json = (await response.json()) as {
      data: { action: string; accepted: boolean };
    };

    expect(response.status).toBe(202);
    expect(json.data).toEqual({ action: "factory-reset", accepted: true });
    expect(deleteScheduledRebootArtifacts).toHaveBeenCalledOnce();
    expect(deleteFactoryResetArtifacts).toHaveBeenCalledOnce();
    expect(scheduleFactoryReset).toHaveBeenCalledOnce();
  });

  it("returns 401 when the session is missing or invalid", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/api/v1/system/power/factory-reset", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(scheduleFactoryReset).not.toHaveBeenCalled();
  });

  it("returns 500 when factory reset scheduling fails", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(deleteScheduledRebootArtifacts).mockResolvedValueOnce(undefined);
    vi.mocked(deleteFactoryResetArtifacts).mockResolvedValueOnce(undefined);
    vi.mocked(scheduleFactoryReset).mockRejectedValueOnce(new Error("spawn failed"));

    const request = new NextRequest("http://localhost/api/v1/system/power/factory-reset", {
      method: "POST",
      headers: {
        cookie: "homeio_session=session-token",
      },
    });

    const response = await POST(request);
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to schedule factory reset");
  });
});
