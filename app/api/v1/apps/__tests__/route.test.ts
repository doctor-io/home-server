import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/apps/service", () => ({
  listInstalledApps: vi.fn(),
}));

import { GET } from "@/app/api/v1/apps/route";
import { listInstalledApps } from "@/lib/server/modules/apps/service";

describe("GET /api/v1/apps", () => {
  it("returns installed apps list", async () => {
    vi.mocked(listInstalledApps).mockResolvedValueOnce([
      {
        id: "1",
        name: "Plex",
        status: "running",
        updatedAt: "2026-02-22T12:00:00.000Z",
      },
    ]);

    const response = await GET();
    const json = (await response.json()) as {
      data: unknown[];
      meta: { count: number };
    };

    expect(response.status).toBe(200);
    expect(json.meta.count).toBe(1);
    expect(json.data).toHaveLength(1);
  });

  it("returns 500 when apps service fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(listInstalledApps).mockRejectedValueOnce(new Error("db down"));

    const response = await GET();
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(json.error).toBe("Unable to load apps");
    expect(consoleSpy).toHaveBeenCalled();
  });
});
