import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/power-schedule", () => ({
  getScheduledRebootConfig: vi.fn(),
  setScheduledRebootConfig: vi.fn(),
}));

import { GET, PUT } from "@/app/api/v1/system/power/schedule/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import {
  getScheduledRebootConfig,
  setScheduledRebootConfig,
} from "@/lib/server/modules/system/power-schedule";

describe("/api/v1/system/power/schedule", () => {
  it("returns the stored schedule for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(getScheduledRebootConfig).mockResolvedValueOnce({
      enabled: true,
      frequency: "weekly",
      dayOfWeek: "sunday",
      time: "03:00",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/system/power/schedule"),
    );
    const json = (await response.json()) as { data: unknown };

    expect(response.status).toBe(200);
    expect(json.data).toEqual({
      enabled: true,
      frequency: "weekly",
      dayOfWeek: "sunday",
      time: "03:00",
    });
  });

  it("returns 401 for unauthenticated schedule reads", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest("http://localhost/api/v1/system/power/schedule"),
    );

    expect(response.status).toBe(401);
  });

  it("saves schedule updates for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(setScheduledRebootConfig).mockResolvedValueOnce(undefined);

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/power/schedule", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: true,
          frequency: "daily",
          dayOfWeek: "sunday",
          time: "04:00",
        }),
      }),
    );
    const json = (await response.json()) as { data: unknown };

    expect(response.status).toBe(200);
    expect(json.data).toEqual({
      enabled: true,
      frequency: "daily",
      dayOfWeek: "sunday",
      time: "04:00",
    });
    expect(setScheduledRebootConfig).toHaveBeenCalledWith({
      enabled: true,
      frequency: "daily",
      dayOfWeek: "sunday",
      time: "04:00",
    });
  });

  it("rejects invalid schedule payloads", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "salt:hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/power/schedule", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ enabled: true, frequency: "monthly" }),
      }),
    );
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid scheduled reboot payload");
  });
});
