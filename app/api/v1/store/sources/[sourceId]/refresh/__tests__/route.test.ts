import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/catalog", () => ({
  isStoreSourceClientError: vi.fn(),
  refreshStoreCatalogSource: vi.fn(),
}));

import { POST } from "@/app/api/v1/store/sources/[sourceId]/refresh/route";
import {
  isStoreSourceClientError,
  refreshStoreCatalogSource,
} from "@/lib/server/modules/store/catalog";

describe("store source refresh route", () => {
  it("refreshes a source", async () => {
    vi.mocked(refreshStoreCatalogSource).mockResolvedValueOnce({
      id: "remote-1",
      name: "Community Store",
      url: "https://example.com/store.zip",
      kind: "remote",
      enabled: true,
      status: "ready",
      sourcePath: "/DATA/AppStore/sources/remote-1",
      suppressedAppIds: ["homepage"],
      addedAt: "2026-03-13T10:00:00.000Z",
      updatedAt: "2026-03-13T10:10:00.000Z",
      lastSyncedAt: "2026-03-13T10:10:00.000Z",
      lastError: null,
    });

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ sourceId: "remote-1" }),
    });
    const json = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("remote-1");
  });

  it("maps bad archive errors to 400", async () => {
    vi.mocked(refreshStoreCatalogSource).mockRejectedValueOnce(
      new Error("Catalog archive must contain an Apps or Store directory"),
    );
    vi.mocked(isStoreSourceClientError).mockReturnValueOnce(true);

    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ sourceId: "remote-1" }),
    });

    expect(response.status).toBe(400);
  });
});
