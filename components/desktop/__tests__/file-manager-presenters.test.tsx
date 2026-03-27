/* @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  getEditorLanguage,
  getFileIcon,
  normalizePathForBackend,
  normalizePathForDisplay,
  toUiFileEntry,
} from "@/modules/files/components/file-manager-presenters";

describe("file-manager presenters", () => {
  it("normalizes display and backend path aliases", () => {
    expect(normalizePathForBackend(["Downloads", "photo.jpg"])).toEqual([
      "Download",
      "photo.jpg",
    ]);
    expect(normalizePathForDisplay(["Download", "photo.jpg"])).toEqual([
      "Downloads",
      "photo.jpg",
    ]);
  });

  it("maps API entries into UI file entries", () => {
    expect(
      toUiFileEntry({
        name: "notes.txt",
        path: "Documents/notes.txt",
        type: "file",
        ext: "txt",
        sizeBytes: 1024,
        modifiedAt: "2026-02-27T00:00:00.000Z",
        mtimeMs: 1234,
        starred: true,
      }),
    ).toMatchObject({
      name: "notes.txt",
      path: "Documents/notes.txt",
      type: "file",
      ext: "txt",
      size: "1.00 KB",
      starred: true,
    });
  });

  it("derives editor language from extension", () => {
    expect(
      getEditorLanguage({
        name: "config.yaml",
        path: "Documents/config.yaml",
        type: "file",
        ext: "yaml",
        modified: "--",
        modifiedAt: "",
        mtimeMs: 0,
      }),
    ).toBe("yaml");
  });

  it("renders a folder icon for folder entries", () => {
    const { container } = render(
      getFileIcon({
        name: "Documents",
        path: "Documents",
        type: "folder",
        modified: "--",
        modifiedAt: "",
        mtimeMs: 0,
      }),
    );

    expect(container.querySelector("svg")).not.toBeNull();
  });
});
