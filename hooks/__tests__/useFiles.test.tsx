/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildAssetUrl,
  toFilePath,
  useCreateFile,
  useCreateFolder,
  useFileContent,
  useFilesDirectory,
  usePasteFileEntry,
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
      queryKey: ["files", "list", "Documents"],
    });
  });

  it("exports path helpers", () => {
    expect(toFilePath(["Documents", "notes.txt"])).toBe("Documents/notes.txt");
    expect(toFilePath(["Trash", "notes.txt"])).toBe("Trash/notes.txt");
    expect(buildAssetUrl("Media/photo.png")).toBe(
      "/api/v1/files/asset?path=Media%2Fphoto.png",
    );
  });

  it("creates a folder via files ops endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          root: "/",
          path: "Documents/New Folder",
          type: "folder",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useCreateFolder(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        parentPath: "Documents",
        name: "New Folder",
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/files/ops", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create_folder",
        parentPath: "Documents",
        name: "New Folder",
      }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "list", "Documents"],
    });
  });

  it("creates a file via files ops endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          root: "/",
          path: "Documents/notes.txt",
          type: "file",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useCreateFile(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        parentPath: "Documents",
        name: "notes.txt",
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/files/ops", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "create_file",
        parentPath: "Documents",
        name: "notes.txt",
      }),
    });
  });

  it("pastes copied entries via files ops endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          root: "/",
          path: "Documents/photo.jpg",
          type: "file",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => usePasteFileEntry(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({
        sourcePath: "Media/photo.jpg",
        destinationPath: "Documents",
        operation: "copy",
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/files/ops", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "paste",
        sourcePath: "Media/photo.jpg",
        destinationPath: "Documents",
        operation: "copy",
      }),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "list", "Documents"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["files", "list", "Media"],
    });
  });
});
