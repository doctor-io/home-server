/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseFilesDirectory = vi.fn();
const mockUseFileContent = vi.fn();
const mockUseSaveFileContent = vi.fn();
const mockUseCreateFolder = vi.fn();
const mockUseCreateFile = vi.fn();
const mockUsePasteFileEntry = vi.fn();
const mockUseRenameFileEntry = vi.fn();
const mockUseFileEntryInfo = vi.fn();
const mockUseToggleFileStar = vi.fn();
const mockUseFilesRoot = vi.fn();
const mockUseMoveToTrash = vi.fn();
const mockUseRestoreFromTrash = vi.fn();
const mockUseDeleteFromTrash = vi.fn();
const mockUseEmptyTrash = vi.fn();
const mockUseNetworkShares = vi.fn();
const mockUseLocalFolderShares = vi.fn();
const mockUseCreateLocalFolderShare = vi.fn();
const mockUseDeleteLocalFolderShare = vi.fn();
const mockUseSystemMetrics = vi.fn();

vi.mock("@/hooks/useFiles", () => ({
  buildAssetUrl: (filePath: string) => `/api/v1/files/asset?path=${encodeURIComponent(filePath)}`,
  buildDownloadUrl: (filePath: string) =>
    `/api/v1/files/download?path=${encodeURIComponent(filePath)}`,
  toFilePath: (segments: string[]) => segments.join("/"),
  useFilesRoot: (...args: unknown[]) => mockUseFilesRoot(...args),
  useFilesDirectory: (...args: unknown[]) => mockUseFilesDirectory(...args),
  useFileContent: (...args: unknown[]) => mockUseFileContent(...args),
  useSaveFileContent: (...args: unknown[]) => mockUseSaveFileContent(...args),
  useCreateFolder: (...args: unknown[]) => mockUseCreateFolder(...args),
  useCreateFile: (...args: unknown[]) => mockUseCreateFile(...args),
  usePasteFileEntry: (...args: unknown[]) => mockUsePasteFileEntry(...args),
  useRenameFileEntry: (...args: unknown[]) => mockUseRenameFileEntry(...args),
  useFileEntryInfo: (...args: unknown[]) => mockUseFileEntryInfo(...args),
  useToggleFileStar: (...args: unknown[]) => mockUseToggleFileStar(...args),
}));

vi.mock("@/hooks/useTrashActions", () => ({
  useMoveToTrash: (...args: unknown[]) => mockUseMoveToTrash(...args),
  useRestoreFromTrash: (...args: unknown[]) => mockUseRestoreFromTrash(...args),
  useDeleteFromTrash: (...args: unknown[]) => mockUseDeleteFromTrash(...args),
  useEmptyTrash: (...args: unknown[]) => mockUseEmptyTrash(...args),
}));

vi.mock("@/hooks/useNetworkShares", () => ({
  useNetworkShares: (...args: unknown[]) => mockUseNetworkShares(...args),
}));

vi.mock("@/hooks/useSystemMetrics", () => ({
  useSystemMetrics: (...args: unknown[]) => mockUseSystemMetrics(...args),
}));

vi.mock("@/hooks/useLocalFolderShares", () => ({
  useLocalFolderShares: (...args: unknown[]) => mockUseLocalFolderShares(...args),
  useCreateLocalFolderShare: (...args: unknown[]) =>
    mockUseCreateLocalFolderShare(...args),
  useDeleteLocalFolderShare: (...args: unknown[]) =>
    mockUseDeleteLocalFolderShare(...args),
}));

vi.mock("@/components/desktop/network-storage-dialog", () => ({
  NetworkStorageDialog: () => null,
}));

import { FileManager } from "@/components/desktop/file-manager";

function mockDirectory(entries: Array<{ name: string; path: string; type: "folder" | "file" }>) {
  return {
    data: {
      entries: entries.map((entry) => ({
        name: entry.name,
        path: entry.path,
        type: entry.type,
        ext: null,
        sizeBytes: entry.type === "file" ? 0 : null,
        modifiedAt: "2026-02-27T00:00:00.000Z",
        mtimeMs: 1234,
      })),
    },
    isLoading: false,
    isError: false,
    error: null,
  };
}

describe("FileManager sharing and navigation", () => {
  beforeEach(() => {
    mockUseFilesDirectory.mockReset();
    mockUseFileContent.mockReset();
    mockUseSaveFileContent.mockReset();
    mockUseCreateFolder.mockReset();
    mockUseCreateFile.mockReset();
    mockUsePasteFileEntry.mockReset();
    mockUseRenameFileEntry.mockReset();
    mockUseFileEntryInfo.mockReset();
    mockUseToggleFileStar.mockReset();
    mockUseFilesRoot.mockReset();
    mockUseMoveToTrash.mockReset();
    mockUseRestoreFromTrash.mockReset();
    mockUseDeleteFromTrash.mockReset();
    mockUseEmptyTrash.mockReset();
    mockUseNetworkShares.mockReset();
    mockUseLocalFolderShares.mockReset();
    mockUseCreateLocalFolderShare.mockReset();
    mockUseDeleteLocalFolderShare.mockReset();
    mockUseSystemMetrics.mockReset();

    mockUseFilesDirectory.mockReturnValue(mockDirectory([]));
    mockUseFilesRoot.mockReturnValue({
      data: {
        rootPath: "/DATA",
        effectiveUid: 1000,
        effectiveGid: 1000,
        writable: true,
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseFileContent.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseSaveFileContent.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseCreateFolder.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        root: "/DATA",
        path: "Documents/New Folder",
        type: "folder",
      }),
      isPending: false,
    });
    mockUseCreateFile.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        root: "/DATA",
        path: "Documents/New File.txt",
        type: "file",
      }),
      isPending: false,
    });
    mockUsePasteFileEntry.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        root: "/DATA",
        path: "Documents/FolderToShare",
        type: "folder",
      }),
      isPending: false,
    });
    mockUseRenameFileEntry.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseFileEntryInfo.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseToggleFileStar.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseMoveToTrash.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseRestoreFromTrash.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseDeleteFromTrash.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
    mockUseEmptyTrash.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        deletedCount: 2,
      }),
      isPending: false,
    });
    mockUseNetworkShares.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseSystemMetrics.mockReturnValue({
      data: {
        storage: {
          mountPath: "/DATA",
          totalBytes: 4 * 1024 ** 4,
          availableBytes: 2.2 * 1024 ** 4,
          usedBytes: 1.8 * 1024 ** 4,
          usedPercent: 45,
        },
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseLocalFolderShares.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
    });
    mockUseCreateLocalFolderShare.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        id: "local-1",
        shareName: "FolderToShare",
        sourcePath: "FolderToShare",
        sharedPath: "Shared/FolderToShare",
        isMounted: true,
        isExported: true,
      }),
    });
    mockUseDeleteLocalFolderShare.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        removed: true,
        id: "local-1",
      }),
    });
  });

  it("navigates to /Shared from sidebar Shared button", async () => {
    render(<FileManager />);

    fireEvent.click(screen.getByRole("button", { name: "Shared" }));

    await waitFor(() => {
      const calls = mockUseFilesDirectory.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[calls.length - 1]?.[0]).toEqual(["Shared"]);
    });
  });

  it("shows network hosts under Locations", () => {
    mockUseNetworkShares.mockReturnValue({
      data: [
        {
          id: "share-1",
          host: "nastabib.local",
          share: "Media",
          username: "user",
          mountPath: "Network/nastabib.local/Media",
          isMounted: true,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FileManager />);

    expect(
      screen.getByRole("button", { name: "nastabib.local" }),
    ).toBeTruthy();
  });

  it("renders real storage usage text in sidebar", () => {
    render(<FileManager />);
    expect(screen.getByText("1.8 TB / 4 TB")).toBeTruthy();
  });

  it("shows Share Folder action when folder is not shared", () => {
    mockUseFilesDirectory.mockReturnValue(
      mockDirectory([
        {
          name: "FolderToShare",
          path: "FolderToShare",
          type: "folder",
        },
      ]),
    );

    render(<FileManager />);

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /FolderToShare/i }),
      { clientX: 120, clientY: 120 },
    );

    expect(screen.getByRole("button", { name: "Share Folder" })).toBeTruthy();
  });

  it("shows Stop Sharing action when folder is already shared", () => {
    mockUseFilesDirectory.mockReturnValue(
      mockDirectory([
        {
          name: "FolderToShare",
          path: "FolderToShare",
          type: "folder",
        },
      ]),
    );
    mockUseLocalFolderShares.mockReturnValue({
      data: [
        {
          id: "local-1",
          shareName: "FolderToShare",
          sourcePath: "FolderToShare",
          sharedPath: "Shared/FolderToShare",
          isMounted: true,
          isExported: true,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FileManager />);

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /FolderToShare/i }),
      { clientX: 120, clientY: 120 },
    );

    expect(screen.getByRole("button", { name: "Stop Sharing" })).toBeTruthy();
  });

  it("creates folder and file from header actions", async () => {
    const promptSpy = vi.spyOn(window, "prompt");
    promptSpy
      .mockReturnValueOnce("New Folder")
      .mockReturnValueOnce("New File.txt");

    render(<FileManager />);

    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    fireEvent.click(screen.getByRole("button", { name: /new file/i }));

    const createFolderCall =
      mockUseCreateFolder.mock.results[0]?.value?.mutateAsync as
        | ((payload: { parentPath: string; name: string }) => Promise<unknown>)
        | undefined;
    const createFileCall =
      mockUseCreateFile.mock.results[0]?.value?.mutateAsync as
        | ((payload: { parentPath: string; name: string }) => Promise<unknown>)
        | undefined;

    await waitFor(() => {
      expect(createFolderCall).toBeDefined();
      expect(createFileCall).toBeDefined();
    });

    expect(createFolderCall).toHaveBeenCalledWith({
      parentPath: "",
      name: "New Folder",
    });
    expect(createFileCall).toHaveBeenCalledWith({
      parentPath: "",
      name: "New File.txt",
    });

    promptSpy.mockRestore();
  });

  it("copies and pastes using context menu", async () => {
    mockUseFilesDirectory.mockReturnValue(
      mockDirectory([
        {
          name: "FolderToShare",
          path: "FolderToShare",
          type: "folder",
        },
      ]),
    );

    render(<FileManager />);

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /FolderToShare/i }),
      { clientX: 100, clientY: 100 },
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    fireEvent.contextMenu(
      screen.getByRole("button", { name: /FolderToShare/i }),
      { clientX: 110, clientY: 110 },
    );
    fireEvent.click(screen.getByRole("button", { name: "Paste" }));

    const pasteCall = mockUsePasteFileEntry.mock.results[0]?.value?.mutateAsync as
      | ((payload: {
          sourcePath: string;
          destinationPath: string;
          operation: "copy" | "move";
        }) => Promise<unknown>)
      | undefined;

    await waitFor(() => {
      expect(pasteCall).toBeDefined();
      expect(pasteCall).toHaveBeenCalledWith({
        sourcePath: "FolderToShare",
        destinationPath: "FolderToShare",
        operation: "copy",
      });
    });
  });

  it("shows Empty Trash in header and deletes all trash entries", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const emptyMutateAsync = vi.fn().mockResolvedValue({
      deletedCount: 2,
    });
    mockUseEmptyTrash.mockReturnValue({
      mutateAsync: emptyMutateAsync,
      isPending: false,
    });
    mockUseFilesDirectory.mockImplementation((pathSegments: string[]) => {
      if (pathSegments[0] === "Trash") {
        return mockDirectory([
          {
            name: "a.txt",
            path: "Trash/a.txt",
            type: "file",
          },
          {
            name: "b.txt",
            path: "Trash/b.txt",
            type: "file",
          },
        ]);
      }
      return mockDirectory([]);
    });

    render(<FileManager />);

    fireEvent.click(screen.getByRole("button", { name: "Trash" }));

    const emptyTrashButton = await screen.findByRole("button", {
      name: /empty trash/i,
    });
    fireEvent.click(emptyTrashButton);

    await waitFor(() => {
      expect(emptyMutateAsync).toHaveBeenCalledTimes(1);
    });

    confirmSpy.mockRestore();
  });
});
