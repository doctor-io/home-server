import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/catalog", () => ({
  findStoreCatalogTemplateByAppId: vi.fn(),
  getStoreCatalogSnapshot: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/custom-apps", () => ({
  findCustomStoreTemplateByAppId: vi.fn(),
  listCustomStoreTemplates: vi.fn(),
}));

vi.mock("@/lib/server/modules/apps/stacks-repository", () => ({
  findInstalledStackByAppId: vi.fn(),
  listInstalledStacksFromDb: vi.fn(),
  patchInstalledStackMeta: vi.fn(),
}));

vi.mock("@/lib/server/modules/apps/operations", () => ({
  startStoreOperation: vi.fn(),
}));

vi.mock("@/lib/server/modules/store/update-check", () => ({
  resolveStoreAppUpdateState: vi.fn(),
}));

import {
  findStoreCatalogTemplateByAppId,
  getStoreCatalogSnapshot,
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
  getStoreCatalogView,
  startAppLifecycleAction,
} from "@/lib/server/modules/store/service";

function createCatalogApp(overrides: Partial<Awaited<ReturnType<typeof getStoreCatalogSnapshot>>["apps"][number]> = {}) {
  return {
    appId: "adguard-home",
    templateName: "adguard-home",
    name: "AdGuard Home",
    description: "DNS",
    platform: "Docker Compose",
    note: "note",
    categories: ["Network"],
    logoUrl: null,
    repositoryUrl: "https://github.com/IceWhaleTech/CasaOS-AppStore",
    stackFile: "Apps/AdGuardHome/docker-compose.yml",
    composePath: "/tmp/CasaOS-AppStore/Apps/AdGuardHome/docker-compose.yml",
    env: [],
    screenshots: [],
    image: "adguard/adguardhome:v1",
    volumes: [],
    port: 3001,
    scheme: "http",
    index: "/",
    mainServiceName: "adguard-home",
    ...overrides,
  };
}

function createInstalledStack(overrides: Partial<Awaited<ReturnType<typeof listInstalledStacksFromDb>>[number]> = {}) {
  return {
    appId: "adguard-home",
    templateName: "adguard-home",
    stackName: "adguard-home",
    composePath: "/tmp/compose.yml",
    status: "installed" as const,
    webUiPort: 3001,
    env: {},
    displayName: null,
    iconUrl: null,
    installedAt: "2026-02-23T00:00:00.000Z",
    updatedAt: "2026-02-23T00:00:00.000Z",
    isUpToDate: true,
    lastUpdateCheck: null,
    localDigest: "sha256:aaa",
    remoteDigest: "sha256:aaa",
    ...overrides,
  };
}

describe("store service", () => {
  beforeEach(() => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockReset();
    vi.mocked(getStoreCatalogSnapshot).mockReset();
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
    vi.mocked(getStoreCatalogSnapshot).mockResolvedValue({
      apps: [createCatalogApp()],
      categories: [{ id: "network", name: "Network", description: "Network apps", appCount: 1 }],
      featuredAppIds: ["adguard-home"],
      recommendedAppIds: ["adguard-home"],
      sourcePath: "/DATA/AppStore/CasaOS-AppStore",
    });
  });

  it("merges catalog with installed stack state and exposes catalog meta", async () => {
    vi.mocked(listInstalledStacksFromDb).mockResolvedValueOnce([createInstalledStack()]);
    vi.mocked(getStoreCatalogSnapshot).mockResolvedValueOnce({
      apps: [
        createCatalogApp({
          description: "A".repeat(400),
        }),
      ],
      categories: [{ id: "network", name: "Network", description: "Network apps", appCount: 1 }],
      featuredAppIds: ["adguard-home"],
      recommendedAppIds: ["adguard-home"],
      sourcePath: "/DATA/AppStore/CasaOS-AppStore",
    });

    const result = await getStoreCatalogView({ installedOnly: true });

    expect(result.apps).toEqual([
      expect.objectContaining({
        id: "adguard-home",
        status: "installed",
        webUiPort: 3001,
        updateAvailable: false,
        description: `${"A".repeat(219)}…`,
      }),
    ]);
    expect(result.categories[0]?.name).toBe("Network");
    expect(result.featuredAppIds).toContain("adguard-home");
  });

  it("returns detail or null", async () => {
    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValueOnce(createCatalogApp({ appId: "homepage", templateName: "homepage", name: "Homepage" }));
    vi.mocked(findInstalledStackByAppId).mockResolvedValueOnce(null);

    const detail = await getStoreAppDetail("homepage");
    expect(detail?.id).toBe("homepage");
    expect(detail?.description).toBe("DNS");
    expect(detail?.screenshots).toEqual([]);

    vi.mocked(findStoreCatalogTemplateByAppId).mockResolvedValueOnce(null);
    const missing = await getStoreAppDetail("missing");
    expect(missing).toBeNull();
  });

  it("proxies lifecycle action start", async () => {
    vi.mocked(startStoreOperation).mockResolvedValueOnce({
      operationId: "11111111-1111-1111-1111-111111111111",
    });

    const result = await startAppLifecycleAction({
      appId: "homepage",
      action: "redeploy",
      webUiPort: 3100,
    });

    expect(result).toEqual({
      operationId: "11111111-1111-1111-1111-111111111111",
    });
    expect(startStoreOperation).toHaveBeenCalledWith({
      appId: "homepage",
      action: "redeploy",
      displayName: undefined,
      env: undefined,
      webUiPort: 3100,
      composeSource: undefined,
      removeVolumes: undefined,
      resetToCatalog: undefined,
    });
  });
});
