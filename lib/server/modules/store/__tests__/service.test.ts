import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/catalog", () => ({
  findStoreCatalogTemplateByAppId: vi.fn(),
  listStoreCatalogTemplates: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/custom-apps", () => ({
  findCustomStoreTemplateByAppId: vi.fn(),
  listCustomStoreTemplates: vi.fn(),
}));

vi.mock("@/lib/server/modules/apps/stacks-repository", () => ({
  findInstalledStackByAppId: vi.fn(),
  listInstalledStacksFromDb: vi.fn(),
}));

vi.mock("@/lib/server/modules/apps/operations", () => ({
  startStoreOperation: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/update-check", () => ({
  resolveStoreAppUpdateState: vi.fn(),
}));

import {
  findStoreCatalogTemplateByAppId,
  listStoreCatalogTemplates,
} from "@/lib/server/modules/store/catalog";
import {
  findCustomStoreTemplateByAppId,
  listCustomStoreTemplates,
} from "@/lib/server/modules/store/custom-apps";
import { startStoreOperation } from "@/lib/server/modules/apps/operations";
import {
  findInstalledStackByAppId,
  listInstalledStacksFromDb,
} from "@/lib/server/modules/apps/stacks-repository";
import { resolveStoreAppUpdateState } from "@/lib/server/modules/store/update-check";
import {
  getStoreAppDetail,
  listStoreApps,
  startAppLifecycleAction,
} from "@/lib/server/modules/store/service";

describe("store service", () => {
  beforeEach(() => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockReset();
    vi.mocked(listStoreCatalogTemplates).mockReset();
    vi.mocked(findCustomStoreTemplateByAppId).mockReset();
    vi.mocked(listCustomStoreTemplates).mockReset();
    vi.mocked(findInstalledStackByAppId).mockReset();
    vi.mocked(listInstalledStacksFromDb).mockReset();
    vi.mocked(startStoreOperation).mockReset();
    vi.mocked(resolveStoreAppUpdateState).mockReset();
    vi.mocked(listCustomStoreTemplates).mockResolvedValue([]);
    vi.mocked(findCustomStoreTemplateByAppId).mockResolvedValue(null);
    vi.mocked(resolveStoreAppUpdateState).mockResolvedValue({
      updateAvailable: false,
      localDigest: null,
      remoteDigest: null,
      image: null,
    });
  });

  it("merges template catalog with installed stack state", async () => {
    vi.mocked(listStoreCatalogTemplates).mockResolvedValueOnce([
      {
        appId: "adguard-home",
        templateName: "adguard-home",
        name: "AdGuard Home",
        description: "DNS",
        platform: "Docker",
        note: "note",
        categories: ["Network"],
        logoUrl: null,
        repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
        stackFile: "Apps/adguard-home/docker-compose.yml",
        env: [],
      },
    ]);
    vi.mocked(listInstalledStacksFromDb).mockResolvedValueOnce([
      {
        appId: "adguard-home",
        templateName: "adguard-home",
        stackName: "adguard-home",
        composePath: "/tmp/compose.yml",
        status: "installed",
        webUiPort: 3001,
        env: {},
        installedAt: "2026-02-23T00:00:00.000Z",
        updatedAt: "2026-02-23T00:00:00.000Z",
      },
    ]);

    const result = await listStoreApps({
      installedOnly: true,
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: "adguard-home",
        status: "installed",
        webUiPort: 3001,
        updateAvailable: false,
      }),
    ]);
  });

  it("filters apps by real update availability when updatesOnly is set", async () => {
    vi.mocked(listStoreCatalogTemplates).mockResolvedValueOnce([
      {
        appId: "adguard-home",
        templateName: "adguard-home",
        name: "AdGuard Home",
        description: "DNS",
        platform: "Docker",
        note: "note",
        categories: ["Network"],
        logoUrl: null,
        repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
        stackFile: "Apps/adguard-home/docker-compose.yml",
        env: [],
      },
      {
        appId: "homepage",
        templateName: "homepage",
        name: "Homepage",
        description: "Dashboard",
        platform: "Docker",
        note: "note",
        categories: ["Productivity"],
        logoUrl: null,
        repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
        stackFile: "Apps/Homepage/docker-compose.yml",
        env: [],
      },
    ]);
    vi.mocked(listInstalledStacksFromDb).mockResolvedValueOnce([
      {
        appId: "adguard-home",
        templateName: "adguard-home",
        stackName: "adguard-home",
        composePath: "/tmp/adguard/docker-compose.yml",
        status: "installed",
        webUiPort: 3001,
        env: {},
        installedAt: "2026-02-23T00:00:00.000Z",
        updatedAt: "2026-02-23T00:00:00.000Z",
      },
      {
        appId: "homepage",
        templateName: "homepage",
        stackName: "homepage",
        composePath: "/tmp/homepage/docker-compose.yml",
        status: "installed",
        webUiPort: 3000,
        env: {},
        installedAt: "2026-02-23T00:00:00.000Z",
        updatedAt: "2026-02-23T00:00:00.000Z",
      },
    ]);
    vi.mocked(resolveStoreAppUpdateState)
      .mockResolvedValueOnce({
        updateAvailable: true,
        localDigest: "sha256:111",
        remoteDigest: "sha256:222",
        image: "adguard:latest",
      })
      .mockResolvedValueOnce({
        updateAvailable: false,
        localDigest: "sha256:333",
        remoteDigest: "sha256:333",
        image: "homepage:latest",
      });

    const result = await listStoreApps({
      updatesOnly: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "adguard-home",
        updateAvailable: true,
        localDigest: "sha256:111",
        remoteDigest: "sha256:222",
      }),
    );
  });

  it("returns detail or null", async () => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValueOnce({
      appId: "homepage",
      templateName: "homepage",
      name: "Homepage",
      description: "Dashboard",
      platform: "Docker",
      note: "note",
      categories: ["Productivity"],
      logoUrl: null,
      repositoryUrl: "https://github.com/bigbeartechworld/big-bear-portainer",
      stackFile: "Apps/Homepage/docker-compose.yml",
      env: [],
    });
    vi.mocked(findInstalledStackByAppId).mockResolvedValueOnce(null);

    const detail = await getStoreAppDetail("homepage");
    expect(detail?.id).toBe("homepage");

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValueOnce(null);
    const missing = await getStoreAppDetail("missing");
    expect(missing).toBeNull();
  });

  it("proxies lifecycle action start", async () => {
    vi.mocked(startStoreOperation).mockResolvedValueOnce({
      operationId: "op-1",
    });

    const result = await startAppLifecycleAction({
      appId: "homepage",
      action: "redeploy",
      webUiPort: 3100,
    });

    expect(result).toEqual({
      operationId: "op-1",
    });
    expect(startStoreOperation).toHaveBeenCalledWith({
      appId: "homepage",
      action: "redeploy",
      displayName: undefined,
      env: undefined,
      webUiPort: 3100,
      removeVolumes: undefined,
    });
  });

  it("includes custom templates in store catalog responses", async () => {
    vi.mocked(listStoreCatalogTemplates).mockResolvedValueOnce([]);
    vi.mocked(listCustomStoreTemplates).mockResolvedValueOnce([
      {
        appId: "custom-homepage",
        templateName: "My Homepage",
        name: "My Homepage",
        description: "Custom app installed from docker compose",
        platform: "Docker Compose",
        note: "Custom app definition managed from App Store.",
        categories: ["Custom"],
        logoUrl: "https://example.com/icon.png",
        repositoryUrl: "custom://local",
        stackFile: "custom/custom-homepage/docker-compose.yml",
        env: [],
        isCustom: true,
        sourceType: "docker-compose",
        composeContent: "services:\n  app:\n    image: nginx",
        sourceText: "services:\n  app:\n    image: nginx",
        webUiUrl: "http://localhost:8088",
      },
    ]);
    vi.mocked(listInstalledStacksFromDb).mockResolvedValueOnce([]);

    const result = await listStoreApps();

    expect(result).toEqual([
      expect.objectContaining({
        id: "custom-homepage",
        name: "My Homepage",
        status: "not_installed",
      }),
    ]);
  });
});
