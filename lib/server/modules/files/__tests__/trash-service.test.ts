import { lstat, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockDataRoot = "";

vi.mock("@/lib/server/modules/files/path-resolver", () => {
  class FilesPathError extends Error {
    code: string;
    statusCode: number;

    constructor(
      message: string,
      options?: {
        code?: string;
        statusCode?: number;
      },
    ) {
      super(message);
      this.code = options?.code ?? "internal_error";
      this.statusCode = options?.statusCode ?? 500;
    }
  }

  function ensureWithinRoot(rootPath: string, absolutePath: string) {
    const relative = path.relative(rootPath, absolutePath);
    const within =
      relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
    if (!within) {
      throw new FilesPathError("Path escapes root", {
        code: "path_outside_root",
        statusCode: 400,
      });
    }
  }

  return {
    FilesPathError,
    resolvePathWithinFilesRoot: vi.fn(async (input: {
      inputPath?: string;
      allowHiddenSegments?: boolean;
      requiredPrefix?: string;
      allowMissingLeaf?: boolean;
    }) => {
      const cleaned = (input.inputPath ?? "").trim().replaceAll("\\", "/");
      const normalized = cleaned ? path.posix.normalize(cleaned) : "";
      if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
        throw new FilesPathError("Invalid path", {
          code: "invalid_path",
          statusCode: 400,
        });
      }

      const relativePath = normalized;
      const segments = relativePath.split("/");
      if (!input.allowHiddenSegments && segments.some((segment) => segment.startsWith("."))) {
        throw new FilesPathError("Hidden files are not allowed", {
          code: "hidden_blocked",
          statusCode: 403,
        });
      }
      if (
        input.requiredPrefix &&
        relativePath !== input.requiredPrefix &&
        !relativePath.startsWith(`${input.requiredPrefix}/`)
      ) {
        throw new FilesPathError("Invalid path", {
          code: "invalid_path",
          statusCode: 400,
        });
      }

      let current = mockDataRoot;
      for (const segment of segments) {
        current = path.join(current, segment);
        try {
          const info = await lstat(current);
          if (info.isSymbolicLink()) {
            throw new FilesPathError("Symlinks are not allowed", {
              code: "symlink_blocked",
              statusCode: 403,
            });
          }
        } catch (error) {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError?.code === "ENOENT") {
            if (input.allowMissingLeaf) break;
            throw new FilesPathError("File or directory not found", {
              code: "not_found",
              statusCode: 404,
            });
          }
          throw error;
        }
      }

      const absolutePath = path.resolve(mockDataRoot, relativePath);
      ensureWithinRoot(mockDataRoot, absolutePath);

      return {
        rootPath: mockDataRoot,
        relativePath,
        absolutePath,
        segments,
        exists: true,
      };
    }),
  };
});

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
