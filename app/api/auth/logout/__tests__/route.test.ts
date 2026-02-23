import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/service", () => ({
  logoutSession: vi.fn(),
}));

import { POST } from "@/app/api/auth/logout/route";
import { logoutSession } from "@/lib/server/modules/auth/service";

describe("POST /api/auth/logout", () => {
  it("deletes session and clears cookie", async () => {
    const request = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST",
      headers: {
        cookie: "homeio_session=session-token",
      },
    });

    const response = await POST(request);

    expect(logoutSession).toHaveBeenCalledWith("session-token");
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("homeio_session=");
  });
});
