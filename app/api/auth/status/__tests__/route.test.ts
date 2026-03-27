import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/auth/repository", () => ({
  hasAnyUsers: vi.fn(),
}));

import { GET } from "@/app/api/auth/status/route";
import { hasAnyUsers } from "@/lib/server/modules/auth/repository";

describe("GET /api/auth/status", () => {
  it("returns whether users exist", async () => {
    vi.mocked(hasAnyUsers).mockResolvedValueOnce(true);

    const response = await GET();
    const json = (await response.json()) as {
      data: { hasUsers: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.data.hasUsers).toBe(true);
  });

  it("returns 500 when auth status query fails", async () => {
    vi.mocked(hasAnyUsers).mockRejectedValueOnce(new Error("db down"));

    const response = await GET();
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toContain("Failed");
  });
});
