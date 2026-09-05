/* @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  mockDirectory,
  mockUseFileContent,
  mockUseFilesDirectory,
  renderFileManager,
  resetFileManagerMocks,
} from "./file-manager-test-utils";

describe("FileManager open-file dialog", () => {
  beforeEach(resetFileManagerMocks);

  it("opens a file in a dialog overlay instead of replacing the file list", async () => {
    mockUseFilesDirectory.mockReturnValue(mockDirectory([{ name: "notes.txt", path: "notes.txt", type: "file" }]));
    mockUseFileContent.mockImplementation((filePath: string | null) => {
      if (filePath === "notes.txt") {
        return {
          data: {
            root: "/DATA",
            path: "notes.txt",
            name: "notes.txt",
            ext: "txt",
            mode: "text",
            mimeType: "text/plain",
            sizeBytes: 12,
            modifiedAt: "2026-02-27T00:00:00.000Z",
            mtimeMs: 1234,
            content: "hello world",
          },
          isLoading: false,
          isError: false,
          error: null,
        };
      }
      return { data: null, isLoading: false, isError: false, error: null };
    });

    await renderFileManager();
    fireEvent.doubleClick(screen.getByRole("button", { name: /^notes\.txt/i }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /^notes\.txt/i })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Back to files" })).toBeNull();
  });

  it("ignores stale text preview data when opening an audio file", async () => {
    mockUseFilesDirectory.mockReturnValue(mockDirectory([{ name: "song.mp3", path: "song.mp3", type: "file" }]));
    mockUseFileContent.mockImplementation((filePath: string | null) => {
      if (filePath === "song.mp3") {
        return {
          data: {
            root: "/DATA",
            path: "notes.txt",
            name: "notes.txt",
            ext: "txt",
            mode: "text",
            mimeType: "text/plain",
            sizeBytes: 12,
            modifiedAt: "2026-02-27T00:00:00.000Z",
            mtimeMs: 1234,
            content: "stale text",
          },
          isLoading: false,
          isError: false,
          error: null,
        };
      }
      return { data: null, isLoading: false, isError: false, error: null };
    });

    await renderFileManager();
    fireEvent.doubleClick(screen.getByRole("button", { name: /^song\.mp3/i }));

    await waitFor(() => {
      expect(screen.getByText("Loading file...")).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });
});
