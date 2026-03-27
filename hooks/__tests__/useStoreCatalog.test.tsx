/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStoreCatalog } from "@/modules/apps/hooks/useStoreCatalog";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useStoreCatalog", () => {
  it("loads the store catalog with query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "plex",
            name: "Plex",
            description: "Media server",
            platform: "Docker",
            categories: ["Media"],
            logoUrl: "https://cdn.example.com/plex.png",
            repositoryUrl: "https://github.com/plex",
            stackFile: "Apps/Plex/docker-compose.yml",
            status: "not_installed",
            webUiPort: null,
            updateAvailable: false,
          },
        ],
        meta: {
          count: 1,
          categories: [
            {
              id: "media",
              name: "Media",
              description: "Media apps",
              appCount: 1,
            },
          ],
          featuredAppIds: ["plex"],
          recommendedAppIds: ["plex"],
          sourcePath: "/DATA/AppStore/CasaOS-AppStore",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useStoreCatalog({
          category: "Media",
          search: "plex",
          installedOnly: true,
          updatesOnly: true,
        }),
      {
        wrapper: createWrapper(client),
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.apps).toHaveLength(1);
    expect(result.current.data?.categories[0]?.name).toBe("Media");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/store/apps?category=Media&search=plex&installedOnly=true&updatesOnly=true",
      { cache: "no-store" },
    );
  });

  it("returns error state when request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStoreCatalog(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect((result.current.error as Error).message).toContain("Failed to fetch store catalog");
  });
});
