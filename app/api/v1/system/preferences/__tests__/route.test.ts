import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  authenticateSession: vi.fn(),
}));

vi.mock("@/lib/server/modules/system/preferences-service", () => ({
  getSystemPreferences: vi.fn(),
  updateSystemPreferences: vi.fn(),
}));

import { GET, PUT } from "@/app/api/v1/system/preferences/route";
import { authenticateSession } from "@/lib/server/modules/auth/service";
import {
  getSystemPreferences,
  updateSystemPreferences,
} from "@/lib/server/modules/system/preferences-service";

describe("/api/v1/system/preferences", () => {
  it("returns hostname and timezone for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(getSystemPreferences).mockResolvedValueOnce({
      hostname: "home-node",
      timezone: "Europe/Paris",
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/system/preferences", {
        headers: {
          cookie: "homeio_session=session-token",
        },
      }),
    );
    const json = (await response.json()) as { data: { hostname: string; timezone: string } };

    expect(response.status).toBe(200);
    expect(json.data).toEqual({
      hostname: "home-node",
      timezone: "Europe/Paris",
    });
  });

  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest("http://localhost/api/v1/system/preferences"),
    );

    expect(response.status).toBe(401);
  });

  it("updates system preferences for authenticated users", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(updateSystemPreferences).mockResolvedValueOnce({
      hostname: "homeio-box",
      timezone: "Europe/Berlin",
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/preferences", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: "homeio-box",
          timezone: "Europe/Berlin",
        }),
      }),
    );
    const json = (await response.json()) as { data: { hostname: string; timezone: string } };

    expect(response.status).toBe(200);
    expect(updateSystemPreferences).toHaveBeenCalledWith({
      hostname: "homeio-box",
      timezone: "Europe/Berlin",
    });
    expect(json.data).toEqual({
      hostname: "homeio-box",
      timezone: "Europe/Berlin",
    });
  });

  it("returns 400 for invalid payloads", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/preferences", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hostname: "homeio-box" }),
      }),
    );
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toBe("Invalid system preferences payload");
  });

  it("returns 400 for invalid hostname/timezone values", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(updateSystemPreferences).mockRejectedValueOnce(
      new Error("Invalid timezone. Choose one of the supported timezone options."),
    );

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/preferences", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: "homeio-box",
          timezone: "Europe/Invalid",
        }),
      }),
    );
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toContain("Invalid timezone");
  });

  it("returns 500 when the service fails", async () => {
    vi.mocked(authenticateSession).mockResolvedValueOnce({
      sessionId: "s1",
      userId: "u1",
      username: "ahmed",
      passwordHash: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });
    vi.mocked(updateSystemPreferences).mockRejectedValueOnce(new Error("hostnamectl failed"));

    const response = await PUT(
      new NextRequest("http://localhost/api/v1/system/preferences", {
        method: "PUT",
        headers: {
          cookie: "homeio_session=session-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostname: "homeio-box",
          timezone: "Europe/Berlin",
        }),
      }),
    );
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to update system preferences");
  });
});
