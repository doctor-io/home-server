/* @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStoreApp } from "@/hooks/useStoreApp";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useStoreApp", () => {
  it("loads store app details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
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
          note: "Install Plex",
          env: [],
          installedConfig: null,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStoreApp("plex"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe("plex");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/store/apps/plex", { cache: "no-store" });
  });

  it("returns null for not found app", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStoreApp("missing"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });
});
