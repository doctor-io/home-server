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

  it("returns empty list when app_stacks table is not present", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ table_exists: null }] } as never);

    const result = await listInstalledAppsFromDb();

    expect(result).toEqual([]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it("maps db rows to installed apps contract", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{ table_exists: "app_stacks" }],
    } as never);

    queryMock.mockResolvedValueOnce({
      rows: [
        {
          app_id: "plex",
          template_name: "plex",
          stack_name: "plex-stack",
          compose_path: "/DATA/Apps/plex/docker-compose.yml",
          display_name: "Plex Media Server",
          updated_at: new Date("2026-02-22T12:00:00.000Z"),
        },
        {
          app_id: "home-assistant",
          template_name: "home-assistant",
          stack_name: "home-assistant",
          compose_path: "/DATA/Apps/home-assistant/docker-compose.yml",
          display_name: null,
          updated_at: "2026-02-22T12:10:00.000Z",
        },
      ],
    } as never);

    const result = await listInstalledAppsFromDb();

    expect(result).toEqual([
      {
        id: "plex",
        name: "Plex Media Server",
        stackName: "plex-stack",
        composePath: "/DATA/Apps/plex/docker-compose.yml",
        status: "unknown",
        updatedAt: "2026-02-22T12:00:00.000Z",
      },
      {
        id: "home-assistant",
        name: "home-assistant",
        stackName: "home-assistant",
        composePath: "/DATA/Apps/home-assistant/docker-compose.yml",
        status: "unknown",
        updatedAt: "2026-02-22T12:10:00.000Z",
      },
    ]);
  });
});
