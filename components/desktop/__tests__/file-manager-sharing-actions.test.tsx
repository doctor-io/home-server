/* @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockDirectory,
  mockUseCreateFile,
  mockUseCreateFolder,
  mockUseFilesDirectory,
  mockUseLocalFolderShares,
  mockUsePasteFileEntry,
  mockUseSystemMetrics,
  renderFileManager,
  resetFileManagerMocks,
} from "./file-manager-test-utils";

describe("FileManager sharing and actions", () => {
  beforeEach(resetFileManagerMocks);

  it("shows Share Folder action when folder is not shared", async () => {
    mockUseFilesDirectory.mockReturnValue(mockDirectory([{ name: "FolderToShare", path: "FolderToShare", type: "folder" }]));
    await renderFileManager();

    fireEvent.contextMenu(screen.getByRole("button", { name: /FolderToShare/i }), { clientX: 120, clientY: 120 });
    expect(screen.getByRole("button", { name: "Share Folder" })).toBeTruthy();
  });

  it("shows Unshare Folder action when folder is already shared", async () => {
    mockUseFilesDirectory.mockReturnValue(mockDirectory([{ name: "FolderToShare", path: "FolderToShare", type: "folder" }]));
    mockUseLocalFolderShares.mockReturnValue({
      data: [{ id: "local-1", shareName: "FolderToShare", sourcePath: "FolderToShare", sharedPath: "Shared/FolderToShare", isMounted: true, isExported: true }],
      isLoading: false,
      isError: false,
      error: null,
    });

    await renderFileManager();
    fireEvent.contextMenu(screen.getByRole("button", { name: /FolderToShare/i }), { clientX: 120, clientY: 120 });
    expect(screen.getByRole("button", { name: "Unshare Folder" })).toBeTruthy();
  });

  it("copies shared folder path as smb url when network address is available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    mockUseFilesDirectory.mockImplementation((pathSegments: string[]) => {
      if (JSON.stringify(pathSegments) === JSON.stringify(["Shared"])) {
        return mockDirectory([{ name: "portainer", path: "Shared/portainer", type: "folder" }]);
      }
      return mockDirectory([]);
    });
    mockUseSystemMetrics.mockReturnValue({
      data: {
        hostname: "home-server",
        wifi: { ipv4: "192.168.1.12" },
        storage: { mountPath: "/DATA", totalBytes: 4 * 1024 ** 4, availableBytes: 2.2 * 1024 ** 4, usedBytes: 1.8 * 1024 ** 4, usedPercent: 45 },
      },
      isLoading: false,
      isError: false,
      error: null,
    });

    await renderFileManager();
    fireEvent.click(screen.getByRole("button", { name: "Shared" }));
    fireEvent.contextMenu(screen.getByRole("button", { name: /portainer/i }), { clientX: 120, clientY: 120 });
    fireEvent.click(screen.getByRole("button", { name: "Copy Path" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("smb://192.168.1.12/DATA/Shared/portainer");
    });
  });

  it("creates folder and file from header actions", async () => {
    await renderFileManager();

    fireEvent.contextMenu(screen.getByText("This folder is empty"), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "New Folder" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    fireEvent.contextMenu(screen.getByText("This folder is empty"), { clientX: 110, clientY: 110 });
    fireEvent.click(screen.getByRole("button", { name: /new file/i }));
    fireEvent.change(screen.getByLabelText("File name"), { target: { value: "New File.txt" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mockUseCreateFolder.mock.results[0]?.value?.mutateAsync).toHaveBeenCalledWith({ parentPath: "", name: "New Folder" });
      expect(mockUseCreateFile.mock.results[0]?.value?.mutateAsync).toHaveBeenCalledWith({ parentPath: "", name: "New File.txt" });
    });
  });

  it("copies and pastes using context menu", async () => {
    mockUseFilesDirectory.mockReturnValue(mockDirectory([{ name: "FolderToShare", path: "FolderToShare", type: "folder" }]));
    await renderFileManager();

    fireEvent.contextMenu(screen.getByRole("button", { name: /FolderToShare/i }), { clientX: 100, clientY: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    fireEvent.contextMenu(screen.getByRole("button", { name: /FolderToShare/i }), { clientX: 110, clientY: 110 });
    fireEvent.click(screen.getByRole("button", { name: "Paste" }));

    await waitFor(() => {
      expect(mockUsePasteFileEntry.mock.results[0]?.value?.mutateAsync).toHaveBeenCalledWith({
        sourcePath: "FolderToShare",
        destinationPath: "FolderToShare",
        operation: "copy",
      });
    });
  });
});
