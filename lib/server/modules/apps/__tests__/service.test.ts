import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/apps/repository", () => ({
  listInstalledAppsFromDb: vi.fn(),
}));

import { listInstalledAppsFromDb } from "@/lib/server/modules/apps/repository";
import { listInstalledApps } from "@/lib/server/modules/apps/service";

describe("apps service", () => {
  const repositoryMock = vi.mocked(listInstalledAppsFromDb);

  beforeEach(() => {
    repositoryMock.mockReset();
  });

  it("caches installed apps", async () => {
    repositoryMock.mockResolvedValueOnce([
      {
        id: "1",
        name: "Nextcloud",
        status: "running",
        updatedAt: "2026-02-22T10:00:00.000Z",
      },
    ]);

    const first = await listInstalledApps();
    const second = await listInstalledApps();

    expect(first).toEqual(second);
    expect(repositoryMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache when requested", async () => {
    repositoryMock.mockResolvedValue([
      {
        id: "2",
        name: "Immich",
        status: "stopped",
        updatedAt: "2026-02-22T11:00:00.000Z",
      },
    ]);

    await listInstalledApps({ bypassCache: true });
    await listInstalledApps({ bypassCache: true });

    expect(repositoryMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to empty list when db is unavailable", async () => {
    const unavailableError = Object.assign(
      new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      { code: "ECONNREFUSED" },
    );
    repositoryMock.mockRejectedValueOnce(unavailableError);

    const first = await listInstalledApps({ bypassCache: true });
    const second = await listInstalledApps();

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(repositoryMock).toHaveBeenCalledTimes(1);
  });
});
