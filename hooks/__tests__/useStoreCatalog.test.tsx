/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStoreCatalog } from "@/hooks/useStoreCatalog";
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
            stackFile: "plex/docker-compose.yml",
            status: "not_installed",
            webUiPort: null,
            updateAvailable: false,
            localDigest: null,
            remoteDigest: null,
          },
        ],
        meta: {
          count: 1,
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

    expect(result.current.data).toHaveLength(1);
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
