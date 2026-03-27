import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/modules/store/catalog", () => ({
  isStoreSourceClientError: vi.fn(),
  removeStoreCatalogSource: vi.fn(),
  updateStoreCatalogSource: vi.fn(),
}));

import { DELETE, PATCH } from "@/app/api/v1/store/sources/[sourceId]/route";
import {
  isStoreSourceClientError,
  removeStoreCatalogSource,
  updateStoreCatalogSource,
} from "@/lib/server/modules/store/catalog";

describe("store source item route", () => {
  beforeEach(() => {
    vi.mocked(isStoreSourceClientError).mockReset();
    vi.mocked(removeStoreCatalogSource).mockReset();
    vi.mocked(updateStoreCatalogSource).mockReset();
    vi.mocked(isStoreSourceClientError).mockReturnValue(false);
  });

  it("updates enabled state", async () => {
    vi.mocked(updateStoreCatalogSource).mockResolvedValueOnce({
      id: "remote-1",
      name: "Community Store",
      url: "https://example.com/store.zip",
      kind: "remote",
      enabled: false,
      status: "ready",
      sourcePath: "/DATA/AppStore/sources/remote-1",
      suppressedAppIds: [],
      addedAt: "2026-03-13T10:00:00.000Z",
      updatedAt: "2026-03-13T10:10:00.000Z",
      lastSyncedAt: "2026-03-13T10:00:00.000Z",
      lastError: null,
    });

    const response = await PATCH(
      new Request("http://localhost/api/v1/store/sources/remote-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      {
        params: Promise.resolve({ sourceId: "remote-1" }),
      },
    );
    const json = (await response.json()) as { data: { enabled: boolean } };

    expect(response.status).toBe(200);
    expect(json.data.enabled).toBe(false);
    expect(updateStoreCatalogSource).toHaveBeenCalledWith("remote-1", {
      enabled: false,
    });
  });

  it("returns 400 on invalid patch payload", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/v1/store/sources/remote-1", {
        method: "PATCH",
        body: JSON.stringify({ enabled: "nope" }),
      }),
      {
        params: Promise.resolve({ sourceId: "remote-1" }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("maps immutable source errors to 400", async () => {
    vi.mocked(updateStoreCatalogSource).mockRejectedValueOnce(
      new Error("Official store source cannot be disabled"),
    );
    vi.mocked(isStoreSourceClientError).mockReturnValueOnce(true);

    const response = await PATCH(
      new Request("http://localhost/api/v1/store/sources/official-casaos", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
      }),
      {
        params: Promise.resolve({ sourceId: "official-casaos" }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("deletes remote sources", async () => {
    vi.mocked(removeStoreCatalogSource).mockResolvedValueOnce({
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

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ sourceId: "remote-1" }),
    });
    const json = (await response.json()) as { data: { id: string } };

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("remote-1");
  });

  it("returns 404 when deleting a missing source", async () => {
    vi.mocked(removeStoreCatalogSource).mockRejectedValueOnce(
      new Error("Store source not found"),
    );

    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ sourceId: "missing" }),
    });

    expect(response.status).toBe(404);
  });
});
