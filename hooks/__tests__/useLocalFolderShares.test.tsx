/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useCreateLocalFolderShare,
  useDeleteLocalFolderShare,
  useLocalFolderShares,
} from "@/hooks/useLocalFolderShares";
import { queryKeys } from "@/lib/shared/query-keys";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useLocalFolderShares", () => {
  it("loads shared folders", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "local-1",
            shareName: "Media",
            sourcePath: "Media",
            sharedPath: "Shared/Media",
            isMounted: true,
            isExported: true,
          },
        ],
        meta: { count: 1 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useLocalFolderShares(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/files/shared/folders", {
      cache: "no-store",
    });
  });

  it("creates shared folder and invalidates queries", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          id: "local-1",
          shareName: "Media",
          sourcePath: "Media",
          sharedPath: "Shared/Media",
          isMounted: true,
          isExported: true,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCreateLocalFolderShare(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        path: "Media",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.localFolderShares,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.filesList("Shared"),
    });
  });

  it("deletes shared folder and invalidates queries", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          removed: true,
          id: "local-1",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteLocalFolderShare(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync("local-1");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.localFolderShares,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.filesList("Shared"),
    });
  });
});
