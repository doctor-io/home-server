/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useCreateNetworkShare,
  useDiscoverNetworkServers,
  useNetworkShares,
} from "@/hooks/useNetworkShares";
import { queryKeys } from "@/lib/shared/query-keys";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useNetworkShares", () => {
  it("loads configured network shares", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "share-1",
            host: "nas.local",
            share: "Media",
            username: "user",
            mountPath: "Network/nas.local/Media",
            isMounted: true,
          },
        ],
        meta: { count: 1 },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useNetworkShares(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/files/network/shares", {
      cache: "no-store",
    });
  });

  it("creates share and invalidates network queries", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: "share-1",
          host: "nas.local",
          share: "Media",
          username: "user",
          mountPath: "Network/nas.local/Media",
          isMounted: true,
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateNetworkShare(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        host: "nas.local",
        share: "Media",
        username: "user",
        password: "secret",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.networkShares,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.filesList("Network"),
    });
  });

  it("discovers smb servers", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          servers: ["nas.local"],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();

    const { result } = renderHook(() => useDiscoverNetworkServers(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      const response = await result.current.mutateAsync();
      expect(response.servers).toEqual(["nas.local"]);
    });
  });
});
