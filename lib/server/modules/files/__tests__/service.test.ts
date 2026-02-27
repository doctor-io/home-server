import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockDataRoot = "";

vi.mock("@/lib/server/storage/data-root", () => ({
  ensureDataRootDirectories: vi.fn(async () => ({
    dataRoot: mockDataRoot,
    subdirectories: [],
  })),
  resolveDataRootDirectory: vi.fn(() => mockDataRoot),
}));

import {
  MAX_TEXT_READ_BYTES,
  listDirectory,
  readFileForViewer,
  writeTextFile,
} from "@/lib/server/modules/files/service";

describe("files service", () => {
  beforeEach(async () => {
    mockDataRoot = await mkdtemp(path.join(os.tmpdir(), "home-server-files-"));
  });

  afterEach(async () => {
    if (mockDataRoot) {
      await rm(mockDataRoot, { recursive: true, force: true });
    }
  });

  it("lists folders first and hides hidden and symlink entries by default", async () => {
    await mkdir(path.join(mockDataRoot, "ZetaFolder"), { recursive: true });
    await writeFile(path.join(mockDataRoot, "alpha.txt"), "alpha", "utf8");
    await writeFile(path.join(mockDataRoot, ".hidden.txt"), "hidden", "utf8");
    await symlink(path.join(mockDataRoot, "alpha.txt"), path.join(mockDataRoot, "alpha-link"));

    const result = await listDirectory({
      path: "",
    });

    expect(result.cwd).toBe("");
    expect(result.entries.map((entry) => entry.name)).toEqual([
      "ZetaFolder",
      "alpha.txt",
    ]);
    expect(result.entries[0]?.type).toBe("folder");
    expect(result.entries[1]?.type).toBe("file");
  });

  it("blocks traversal paths outside root", async () => {
    await expect(
      listDirectory({
        path: "../etc",
      }),
    ).rejects.toMatchObject({
      code: "path_outside_root",
    });
  });

  it("blocks symlink traversal", async () => {
    await mkdir(path.join(mockDataRoot, "safe"), { recursive: true });
    await symlink(path.join(mockDataRoot, "safe"), path.join(mockDataRoot, "safe-link"));

    await expect(
      listDirectory({
        path: "safe-link",
      }),
    ).rejects.toMatchObject({
      code: "symlink_blocked",
    });
  });

  it("classifies read mode for text, image, and pdf files", async () => {
    await writeFile(path.join(mockDataRoot, "config.yaml"), "name: home", "utf8");
    await writeFile(path.join(mockDataRoot, "photo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(path.join(mockDataRoot, "manual.pdf"), Buffer.from("%PDF-1.7", "utf8"));

    const textResult = await readFileForViewer({
      path: "config.yaml",
    });
    const imageResult = await readFileForViewer({
      path: "photo.png",
    });
    const pdfResult = await readFileForViewer({
      path: "manual.pdf",
    });

    expect(textResult.mode).toBe("text");
    expect(textResult.content).toBe("name: home");
    expect(imageResult.mode).toBe("image");
    expect(imageResult.content).toBeNull();
    expect(pdfResult.mode).toBe("pdf");
    expect(pdfResult.content).toBeNull();
  });

  it("returns too_large mode for oversized text files", async () => {
    const largeText = "a".repeat(MAX_TEXT_READ_BYTES + 1);
    await writeFile(path.join(mockDataRoot, "large.txt"), largeText, "utf8");

    const result = await readFileForViewer({
      path: "large.txt",
    });

    expect(result.mode).toBe("too_large");
    expect(result.content).toBeNull();
    expect(result.sizeBytes).toBe(MAX_TEXT_READ_BYTES + 1);
  });

  it("writes text files and enforces optimistic mtime conflict", async () => {
    const filePath = path.join(mockDataRoot, "notes.txt");
    await writeFile(filePath, "before", "utf8");

    const opened = await readFileForViewer({
      path: "notes.txt",
    });

    const saved = await writeTextFile({
      path: "notes.txt",
      content: "after",
      expectedMtimeMs: opened.mtimeMs,
    });

    expect(saved.path).toBe("notes.txt");
    expect(await readFile(filePath, "utf8")).toBe("after");

    await writeFile(filePath, "changed-outside", "utf8");

    await expect(
      writeTextFile({
        path: "notes.txt",
        content: "conflict-write",
        expectedMtimeMs: opened.mtimeMs,
      }),
    ).rejects.toMatchObject({
      code: "write_conflict",
    });
  });

  it("shows hidden entries when listing Trash", async () => {
    await mkdir(path.join(mockDataRoot, "Trash"), { recursive: true });
    await writeFile(path.join(mockDataRoot, "Trash", ".env"), "x=1", "utf8");
    await writeFile(path.join(mockDataRoot, "Trash", "notes.txt"), "hello", "utf8");

    const result = await listDirectory({
      path: "Trash",
    });

    expect(result.entries.map((entry) => entry.name)).toEqual([
      ".env",
      "notes.txt",
    ]);
  });
});
