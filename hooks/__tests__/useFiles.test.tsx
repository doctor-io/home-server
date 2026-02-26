/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildAssetUrl,
  toFilePath,
  useFileContent,
  useFilesDirectory,
  useSaveFileContent,
} from "@/hooks/useFiles";
import { queryKeys } from "@/lib/shared/query-keys";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

describe("useFiles hooks", () => {
  it("loads directory entries from files API", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          root: "/",
          cwd: "Documents",
          entries: [],
        },
        meta: {
          count: 0,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useFilesDirectory(["Documents"]), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/files?path=Documents", {
      cache: "no-store",
    });
  });

  it("loads file content by path", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          root: "/",
          path: "Documents/notes.txt",
          name: "notes.txt",
          ext: "txt",
          mode: "text",
          mimeType: "text/plain; charset=utf-8",
          sizeBytes: 6,
          modifiedAt: "2026-02-26T12:00:00.000Z",
          mtimeMs: 11,
          content: "hello!",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useFileContent("Documents/notes.txt"),
      {
        wrapper: createWrapper(client),
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/files/content?path=Documents%2Fnotes.txt",
      {
        cache: "no-store",
      },
    );
  });

  it("saves file content and invalidates related queries", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          root: "/",
          path: "Documents/notes.txt",
          sizeBytes: 7,
          modifiedAt: "2026-02-26T12:00:05.000Z",
          mtimeMs: 22,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useSaveFileContent(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        path: "Documents/notes.txt",
        content: "updated",
        expectedMtimeMs: 11,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/files/content", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: "Documents/notes.txt",
        content: "updated",
        expectedMtimeMs: 11,
      }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.fileContent("Documents/notes.txt"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.filesList("Documents"),
    });
  });

  it("exports path helpers", () => {
    expect(toFilePath(["Documents", "notes.txt"])).toBe("Documents/notes.txt");
    expect(buildAssetUrl("Media/photo.png")).toBe(
      "/api/v1/files/asset?path=Media%2Fphoto.png",
    );
  });
});
