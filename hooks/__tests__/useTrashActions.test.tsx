/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useDeleteFromTrash,
  useMoveToTrash,
  useRestoreFromTrash,
} from "@/hooks/useTrashActions";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useTrashActions", () => {
  it("moves files to trash and invalidates files + trash queries", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          trashPath: "Trash/notes.txt",
          originalPath: "Documents/notes.txt",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useMoveToTrash(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        path: "Documents/notes.txt",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "list", "Documents"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "list", "Trash"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "trash", "entries", "Trash"],
    });
  });

  it("restores from trash and invalidates destination listing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          restoredPath: "Documents/notes.txt",
          sourceTrashPath: "Trash/notes.txt",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRestoreFromTrash(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        path: "Trash/notes.txt",
        collision: "keep-both",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "list", "Documents"],
    });
  });

  it("deletes permanently and invalidates trash listing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          deleted: true,
          path: "Trash/notes.txt",
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useDeleteFromTrash(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        path: "Trash/notes.txt",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "list", "Trash"],
    });
  });
});
