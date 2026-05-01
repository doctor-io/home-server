import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET } from "@/app/api/v1/notifications/stream/route";
import { requireApiSession } from "@/lib/server/modules/auth/api";

describe("GET /api/v1/notifications/stream", () => {
  it("returns 401 without a session before opening the stream", async () => {
    vi.mocked(requireApiSession).mockResolvedValueOnce({
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new Request("http://localhost/api/v1/notifications/stream"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).not.toBe("text/event-stream");
  });
});
