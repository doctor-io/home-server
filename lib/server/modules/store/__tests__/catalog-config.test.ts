import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/storage/data-root", () => ({
  resolveDataRootDirectory: vi.fn(),
}));

import { resolveDataRootDirectory } from "@/lib/server/storage/data-root";

describe("store catalog config", () => {
  let tempRoot = "";

  beforeEach(async () => {
    vi.resetModules();
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "homeio-store-config-"));
    vi.mocked(resolveDataRootDirectory).mockReturnValue(tempRoot);
    await mkdir(path.join(tempRoot, "AppStore"), { recursive: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("migrates the legacy single-source config into an official registry source", async () => {
    await writeFile(
      path.join(tempRoot, "AppStore", "catalog-source.json"),
      JSON.stringify({
        defaultCatalogPath: "/DATA/AppStore/CasaOS-AppStore",
        repoUrl: "https://github.com/IceWhaleTech/CasaOS-AppStore",
        updatedAt: "2026-03-13T10:00:00.000Z",
      }),
      "utf8",
    );

    const { OFFICIAL_STORE_SOURCE_ID, readStoreCatalogSources } = await import(
      "@/lib/server/modules/store/catalog-config"
    );

    const sources = await readStoreCatalogSources();

    expect(sources).toEqual([
      expect.objectContaining({
        id: OFFICIAL_STORE_SOURCE_ID,
        kind: "official",
        enabled: true,
        sourcePath: "/DATA/AppStore/CasaOS-AppStore",
        url: "https://github.com/IceWhaleTech/CasaOS-AppStore",
      }),
    ]);
  });

  it("writes a versioned source registry and keeps the official source first", async () => {
    const { OFFICIAL_STORE_SOURCE_ID, writeStoreCatalogSources } = await import(
      "@/lib/server/modules/store/catalog-config"
    );

    await writeStoreCatalogSources([
      {
        id: "remote-1",
        name: "Community Store",
        url: "https://example.com/store.zip",
        kind: "remote",
        enabled: true,
        status: "ready",
        sourcePath: "/DATA/AppStore/sources/remote-1",
        suppressedAppIds: [],
        addedAt: "2026-03-13T10:00:00.000Z",
        updatedAt: "2026-03-13T10:00:00.000Z",
        lastSyncedAt: "2026-03-13T10:00:00.000Z",
        lastError: null,
      },
    ]);

    const persisted = JSON.parse(
      await readFile(path.join(tempRoot, "AppStore", "catalog-source.json"), "utf8"),
    ) as { version: number; sources: Array<{ id: string }> };

    expect(persisted.version).toBe(2);
    expect(persisted.sources[0]?.id).toBe(OFFICIAL_STORE_SOURCE_ID);
    expect(persisted.sources[1]?.id).toBe("remote-1");
  });
});
