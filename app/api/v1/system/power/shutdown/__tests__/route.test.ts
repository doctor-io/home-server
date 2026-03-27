import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/power-service", () => ({
  scheduleSystemShutdown: vi.fn(),
}));

import { POST } from "@/app/api/v1/system/power/shutdown/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import { scheduleSystemShutdown } from "@/lib/server/modules/system/power-service";

describe("POST /api/v1/system/power/shutdown", () => {
  it("returns 202 and schedules shutdown for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(scheduleSystemShutdown).mockResolvedValueOnce(undefined);

    const request = new NextRequest("http://localhost/api/v1/system/power/shutdown", {
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
    expect(json.data).toEqual({ action: "shutdown", accepted: true });
    expect(scheduleSystemShutdown).toHaveBeenCalledOnce();
  });

  it("returns 401 when the session is missing or invalid", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const request = new NextRequest("http://localhost/api/v1/system/power/shutdown", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(scheduleSystemShutdown).not.toHaveBeenCalled();
  });

  it("returns 500 when shutdown scheduling fails", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(scheduleSystemShutdown).mockRejectedValueOnce(new Error("spawn failed"));

    const request = new NextRequest("http://localhost/api/v1/system/power/shutdown", {
      method: "POST",
      headers: {
        cookie: "homeio_session=session-token",
      },
    });

    const response = await POST(request);
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to schedule shutdown");
  });
});
