/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseFilesDirectory = vi.fn();
const mockUseFileContent = vi.fn();
const mockUseSaveFileContent = vi.fn();
const mockUseMoveToTrash = vi.fn();
const mockUseRestoreFromTrash = vi.fn();
const mockUseDeleteFromTrash = vi.fn();
const mockUseNetworkShares = vi.fn();
const mockUseLocalFolderShares = vi.fn();
const mockUseCreateLocalFolderShare = vi.fn();
const mockUseDeleteLocalFolderShare = vi.fn();

vi.mock("@/hooks/useFiles", () => ({
  buildAssetUrl: (filePath: string) => `/api/v1/files/asset?path=${encodeURIComponent(filePath)}`,
  toFilePath: (segments: string[]) => segments.join("/"),
  useFilesDirectory: (...args: unknown[]) => mockUseFilesDirectory(...args),
  useFileContent: (...args: unknown[]) => mockUseFileContent(...args),
  useSaveFileContent: (...args: unknown[]) => mockUseSaveFileContent(...args),
}));

vi.mock("@/hooks/useTrashActions", () => ({
  useMoveToTrash: (...args: unknown[]) => mockUseMoveToTrash(...args),
  useRestoreFromTrash: (...args: unknown[]) => mockUseRestoreFromTrash(...args),
  useDeleteFromTrash: (...args: unknown[]) => mockUseDeleteFromTrash(...args),
}));

vi.mock("@/hooks/useNetworkShares", () => ({
  useNetworkShares: (...args: unknown[]) => mockUseNetworkShares(...args),
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
    mockUseMoveToTrash.mockReset();
    mockUseRestoreFromTrash.mockReset();
    mockUseDeleteFromTrash.mockReset();
    mockUseNetworkShares.mockReset();
    mockUseLocalFolderShares.mockReset();
    mockUseCreateLocalFolderShare.mockReset();
    mockUseDeleteLocalFolderShare.mockReset();

    mockUseFilesDirectory.mockReturnValue(mockDirectory([]));
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
    mockUseNetworkShares.mockReturnValue({
      data: [],
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
});
