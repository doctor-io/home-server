/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useInstalledApps } from "@/hooks/useInstalledApps";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useInstalledApps", () => {
  it("loads installed apps from api", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              id: "1",
              name: "Plex",
              status: "running",
              updatedAt: "2026-02-22T12:00:00.000Z",
            },
          ],
        }),
      }),
    );

    const client = createTestQueryClient();
    const { result } = renderHook(() => useInstalledApps(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0]?.name).toBe("Plex");
    expect(fetch).toHaveBeenCalledWith("/api/v1/apps", { cache: "no-store" });
  });

  it("polls every 2s when app status is not running and update is recent", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "home-assistant",
            name: "Home Assistant",
            status: "stopped",
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useInstalledApps(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_200));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }, { timeout: 4_000 });
  });

  it("does not poll when app is already running", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "plex",
            name: "Plex",
            status: "running",
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useInstalledApps(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2_200));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
