import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/apps/repository", () => ({
  listInstalledAppsFromDb: vi.fn(),
}));

vi.mock("@/lib/server/modules/docker/compose-runner", () => ({
  getComposeRuntimeInfo: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("@/lib/server/modules/docker/compose-parser", () => ({
  parseComposeFile: vi.fn(),
  extractPrimaryServiceWithName: vi.fn(),
}));

import { listInstalledAppsFromDb } from "@/lib/server/modules/apps/repository";
import { invalidateInstalledAppsCache, listInstalledApps } from "@/lib/server/modules/apps/service";
import { readFile } from "node:fs/promises";
import {
  extractPrimaryServiceWithName,
  parseComposeFile,
} from "@/lib/server/modules/docker/compose-parser";
import { getComposeRuntimeInfo } from "@/lib/server/modules/docker/compose-runner";

describe("apps service", () => {
  const repositoryMock = vi.mocked(listInstalledAppsFromDb);
  const runtimeInfoMock = vi.mocked(getComposeRuntimeInfo);
  const readFileMock = vi.mocked(readFile);
  const parseComposeFileMock = vi.mocked(parseComposeFile);
  const extractPrimaryServiceMock = vi.mocked(extractPrimaryServiceWithName);

  beforeEach(() => {
    invalidateInstalledAppsCache();
    repositoryMock.mockReset();
    runtimeInfoMock.mockReset();
    readFileMock.mockReset();
    parseComposeFileMock.mockReset();
    extractPrimaryServiceMock.mockReset();
    runtimeInfoMock.mockResolvedValue({
      status: "running",
      containerNames: ["nextcloud-app-1"],
      primaryContainerName: "nextcloud-app-1",
    });
    readFileMock.mockResolvedValue("");
    parseComposeFileMock.mockReturnValue(null);
    extractPrimaryServiceMock.mockReturnValue(null);
  });

  it("caches installed apps", async () => {
    repositoryMock.mockResolvedValueOnce([
      {
        id: "nextcloud",
        name: "Nextcloud",
        stackName: "nextcloud",
        composePath: "/DATA/Apps/nextcloud/docker-compose.yml",
        status: "unknown",
        updatedAt: "2026-02-22T10:00:00.000Z",
      },
    ]);

    const first = await listInstalledApps();
    const second = await listInstalledApps();

    expect(first[0]?.containerName).toBe("nextcloud-app-1");
    expect(first).toEqual(second);
    expect(repositoryMock).toHaveBeenCalledTimes(1);
  });

  it("bypasses cache when requested", async () => {
    repositoryMock.mockResolvedValue([
      {
        id: "immich",
        name: "Immich",
        stackName: "immich",
        composePath: "/DATA/Apps/immich/docker-compose.yml",
        status: "unknown",
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

  it("infers web ui port from installed compose when DB port is null", async () => {
    repositoryMock.mockResolvedValueOnce([
      {
        id: "dozzle",
        name: "Dozzle",
        stackName: "dozzle",
        composePath: "/DATA/Apps/dozzle/docker-compose.yml",
        webUiPort: null,
        status: "unknown",
        updatedAt: "2026-02-22T10:00:00.000Z",
      },
    ]);
    readFileMock.mockResolvedValue("services:\n  app:\n    ports:\n      - \"9999:8080\"\n");
    parseComposeFileMock.mockReturnValue({
      services: {
        app: {
          ports: ["9999:8080"],
          environment: {},
        },
      },
    });
    extractPrimaryServiceMock.mockReturnValue({
      name: "app",
      service: {
        ports: ["9999:8080"],
        environment: {},
      },
    });

    const apps = await listInstalledApps({ bypassCache: true });

    expect(apps[0]?.webUiPort).toBe(9999);
    expect(readFileMock).toHaveBeenCalledWith("/DATA/Apps/dozzle/docker-compose.yml", "utf8");
  });
});
