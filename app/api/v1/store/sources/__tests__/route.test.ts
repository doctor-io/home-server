import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/catalog", () => ({
  addStoreCatalogSource: vi.fn(),
  isStoreSourceClientError: vi.fn(),
  listStoreCatalogSources: vi.fn(),
}));

import { GET, POST } from "@/app/api/v1/store/sources/route";
import {
  addStoreCatalogSource,
  isStoreSourceClientError,
  listStoreCatalogSources,
} from "@/lib/server/modules/store/catalog";

describe("store source collection route", () => {
  beforeEach(() => {
    vi.mocked(addStoreCatalogSource).mockReset();
    vi.mocked(isStoreSourceClientError).mockReset();
    vi.mocked(listStoreCatalogSources).mockReset();
    vi.mocked(isStoreSourceClientError).mockReturnValue(false);
  });

  it("lists sources", async () => {
    vi.mocked(listStoreCatalogSources).mockResolvedValueOnce([
      {
        id: "official-casaos",
        name: "Official CasaOS",
        url: "https://github.com/IceWhaleTech/CasaOS-AppStore",
        kind: "official",
        enabled: true,
        status: "ready",
        sourcePath: "/DATA/AppStore/CasaOS-AppStore",
        suppressedAppIds: [],
        addedAt: "2026-03-13T10:00:00.000Z",
        updatedAt: "2026-03-13T10:00:00.000Z",
        lastSyncedAt: "2026-03-13T10:00:00.000Z",
        lastError: null,
      },
    ]);

    const response = await GET();
    const json = (await response.json()) as { data: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]?.id).toBe("official-casaos");
  });

  it("creates a source", async () => {
    vi.mocked(addStoreCatalogSource).mockResolvedValueOnce({
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
    });

    const response = await POST(
      new NextRequest("http://localhost/api/v1/store/sources", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/store.zip",
          name: "Community Store",
        }),
      }),
    );
    const json = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(201);
    expect(json.data.id).toBe("remote-1");
    expect(addStoreCatalogSource).toHaveBeenCalledWith({
      url: "https://example.com/store.zip",
      name: "Community Store",
    });
  });

  it("rejects invalid payloads", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/v1/store/sources", {
        method: "POST",
        body: JSON.stringify({
          url: "not-a-url",
        }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("maps client-facing source errors to 400", async () => {
    vi.mocked(addStoreCatalogSource).mockRejectedValueOnce(
      new Error("Store source already exists"),
    );
    vi.mocked(isStoreSourceClientError).mockReturnValueOnce(true);

    const response = await POST(
      new NextRequest("http://localhost/api/v1/store/sources", {
        method: "POST",
        body: JSON.stringify({
          url: "https://example.com/store.zip",
        }),
      }),
    );
    const json = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(json.error).toBe("Store source already exists");
  });
});
