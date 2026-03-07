import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/catalog-config", () => ({
  readStoreCatalogConfig: vi.fn(),
  resolveStoreCatalogsRoot: vi.fn(() => "/tmp"),
  writeStoreCatalogConfig: vi.fn(),
}));

vi.mock("@/lib/server/storage/data-root", () => ({
  ensureDataRootDirectories: vi.fn(),
}));

import { readStoreCatalogConfig } from "@/lib/server/modules/store/catalog-config";
import { ensureDataRootDirectories } from "@/lib/server/storage/data-root";

describe("store catalog", () => {
  let repoRoot = "";

  beforeEach(async () => {
    vi.resetModules();
    repoRoot = await mkdtemp(path.join(os.tmpdir(), "casaos-catalog-"));
    await mkdir(path.join(repoRoot, "Apps", "AdGuardHome"), { recursive: true });
    await writeFile(
      path.join(repoRoot, "Apps", "AdGuardHome", "docker-compose.yml"),
      `name: adguardhome
services:
  adguardhome:
    image: adguard/adguardhome:v1
    ports:
      - "3001:3000"
x-casaos:
  main: adguardhome
  category: Network
  title:
    en_us: AdGuard Home
  description:
    en_us: Network DNS blocker
  icon: https://example.com/logo.png
  screenshot_link:
    - https://example.com/screenshot.png
  tips:
    before_install:
      en_us: Read this first
  scheme: http
  index: /
  port_map: "3001"
`,
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "category-list.json"),
      JSON.stringify([{ name: "Network", description: "Network apps" }]),
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "featured-apps.json"),
      JSON.stringify([{ appid: "adguardhome" }]),
      "utf8",
    );
    await writeFile(
      path.join(repoRoot, "recommend-list.json"),
      JSON.stringify([{ appid: "adguardhome" }]),
      "utf8",
    );
    vi.mocked(readStoreCatalogConfig).mockResolvedValue({
      defaultCatalogPath: repoRoot,
      repoUrl: "https://github.com/IceWhaleTech/CasaOS-AppStore",
      updatedAt: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("indexes CasaOS compose apps from the local catalog checkout", async () => {
    const { getStoreCatalogSnapshot } = await import("@/lib/server/modules/store/catalog");
    const snapshot = await getStoreCatalogSnapshot({ bypassCache: true });

    expect(ensureDataRootDirectories).toHaveBeenCalled();
    expect(snapshot.apps).toHaveLength(1);
    expect(snapshot.apps[0]).toMatchObject({
      appId: "adguardhome",
      name: "AdGuard Home",
      description: "Network DNS blocker",
      categories: ["Network"],
      repositoryUrl: "https://github.com/IceWhaleTech/CasaOS-AppStore",
      stackFile: "Apps/AdGuardHome/docker-compose.yml",
      port: 3001,
      screenshots: ["https://example.com/screenshot.png"],
    });
    expect(snapshot.categories).toEqual([
      {
        id: "network",
        name: "Network",
        description: "Network apps",
        appCount: 1,
      },
    ]);
    expect(snapshot.featuredAppIds).toEqual(["adguardhome"]);
    expect(snapshot.recommendedAppIds).toEqual(["adguardhome"]);
  });
});
