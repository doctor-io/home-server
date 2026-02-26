import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockDataRoot = "";

vi.mock("@/lib/server/storage/data-root", () => ({
  ensureDataRootDirectories: vi.fn(async () => ({
    dataRoot: mockDataRoot,
    subdirectories: ["Trash", "Documents"],
  })),
}));

vi.mock("@/lib/server/modules/files/trash-repository", () => ({
  upsertTrashEntryInDb: vi.fn(),
  getTrashEntryFromDb: vi.fn(),
  deleteTrashEntryFromDb: vi.fn(),
}));

import {
  deleteFromTrash,
  moveToTrash,
  restoreFromTrash,
  type TrashServiceError,
} from "@/lib/server/modules/files/trash-service";
import {
  deleteTrashEntryFromDb,
  getTrashEntryFromDb,
  upsertTrashEntryInDb,
} from "@/lib/server/modules/files/trash-repository";

describe("trash service", () => {
  beforeEach(async () => {
    mockDataRoot = await mkdtemp(path.join(os.tmpdir(), "home-server-trash-"));
    await mkdir(path.join(mockDataRoot, "Trash"), { recursive: true });
    await mkdir(path.join(mockDataRoot, "Documents"), { recursive: true });
  });

  afterEach(async () => {
    if (mockDataRoot) {
      await rm(mockDataRoot, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it("moves files to Trash and stores metadata", async () => {
    await writeFile(path.join(mockDataRoot, "Documents", "notes.txt"), "hello", "utf8");

    const moved = await moveToTrash("Documents/notes.txt");

    expect(moved.trashPath.startsWith("Trash/")).toBe(true);
    expect(moved.originalPath).toBe("Documents/notes.txt");
    expect(
      await readFile(path.join(mockDataRoot, moved.trashPath), "utf8"),
    ).toBe("hello");
    expect(vi.mocked(upsertTrashEntryInDb)).toHaveBeenCalledWith(
      expect.objectContaining({
        trashPath: moved.trashPath,
        originalPath: "Documents/notes.txt",
      }),
    );
  });

  it("restores using keep-both collision policy", async () => {
    await writeFile(path.join(mockDataRoot, "Trash", "notes.txt"), "from-trash", "utf8");
    await writeFile(path.join(mockDataRoot, "Documents", "notes.txt"), "existing", "utf8");

    vi.mocked(getTrashEntryFromDb).mockResolvedValueOnce({
      id: "trash-1",
      trashPath: "Trash/notes.txt",
      originalPath: "Documents/notes.txt",
      deletedAt: new Date(),
    });

    const restored = await restoreFromTrash("Trash/notes.txt", "keep-both");

    expect(restored.sourceTrashPath).toBe("Trash/notes.txt");
    expect(restored.restoredPath).toBe("Documents/notes (2).txt");
    expect(
      await readFile(path.join(mockDataRoot, "Documents", "notes (2).txt"), "utf8"),
    ).toBe("from-trash");
    expect(vi.mocked(deleteTrashEntryFromDb)).toHaveBeenCalledWith("Trash/notes.txt");
  });

  it("deletes items permanently from Trash", async () => {
    await writeFile(path.join(mockDataRoot, "Trash", "old.log"), "bye", "utf8");

    const deleted = await deleteFromTrash("Trash/old.log");

    expect(deleted.deleted).toBe(true);
    expect(deleted.path).toBe("Trash/old.log");
    expect(vi.mocked(deleteTrashEntryFromDb)).toHaveBeenCalledWith("Trash/old.log");
  });

  it("errors when trash metadata is missing on restore", async () => {
    await writeFile(path.join(mockDataRoot, "Trash", "missing.txt"), "x", "utf8");
    vi.mocked(getTrashEntryFromDb).mockResolvedValueOnce(null);

    await expect(restoreFromTrash("Trash/missing.txt", "keep-both")).rejects.toMatchObject<
      Partial<TrashServiceError>
    >({
      code: "trash_meta_missing",
      statusCode: 404,
    });
  });
});
