import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/db/query", () => ({
  timedPgQuery: vi.fn(),
}));

import { timedPgQuery } from "@/lib/server/db/query";
import { listInstalledAppsFromDb } from "@/lib/server/modules/apps/repository";

describe("apps repository", () => {
  const queryMock = vi.mocked(timedPgQuery);

  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns empty list when apps table is not present", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ table_exists: null }] } as never);

    const result = await listInstalledAppsFromDb();

    expect(result).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("maps db rows to installed apps contract", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ table_exists: "apps" }],
    } as never);

    queryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "a1",
          name: "Plex",
          status: "running",
          updated_at: new Date("2026-02-22T12:00:00.000Z"),
        },
        {
          id: "a2",
          name: "Unknown App",
          status: "mystery",
          updated_at: "2026-02-22T12:10:00.000Z",
        },
      ],
    } as never);

    const result = await listInstalledAppsFromDb();

    expect(result).toEqual([
      {
        id: "a1",
        name: "Plex",
        status: "running",
        updatedAt: "2026-02-22T12:00:00.000Z",
      },
      {
        id: "a2",
        name: "Unknown App",
        status: "unknown",
        updatedAt: "2026-02-22T12:10:00.000Z",
      },
    ]);
  });
});
