import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/env", () => ({
  serverEnv: {
    METRICS_PUBLISH_INTERVAL_MS: 60_000,
    SSE_HEARTBEAT_MS: 60_000,
  },
}));

vi.mock("@/lib/server/modules/docker/stats", () => ({
  getAllContainersStats: vi.fn(async () => ({
    containers: [],
    sampledAt: "2026-02-22T12:00:00.000Z",
  })),
}));

import { GET } from "@/app/api/v1/docker/stats/stream/route";
import { requireApiSession } from "@/lib/server/modules/auth/api";

describe("GET /api/v1/docker/stats/stream", () => {
  it("returns 401 for unauthenticated requests", async () => {
    vi.mocked(requireApiSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new NextRequest("http://localhost/api/v1/docker/stats/stream"),
    );

    expect(response.status).toBe(401);
  });
});
