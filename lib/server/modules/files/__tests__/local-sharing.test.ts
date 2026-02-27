import { mkdtemp, mkdir, rm } from "node:fs/promises";
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

  return {
    FilesPathError,
    resolvePathWithinFilesRoot: vi.fn(async (input: {
      inputPath?: string;
      requiredPrefix?: string;
      allowMissingLeaf?: boolean;
    }) => {
      const cleaned = (input.inputPath ?? "").trim().replaceAll("\\", "/");
      const normalized = cleaned ? path.posix.normalize(cleaned) : "";
      if (normalized === ".." || normalized.startsWith("../")) {
        throw new FilesPathError("Path escapes root", {
          code: "path_outside_root",
          statusCode: 400,
        });
      }

      if (
        input.requiredPrefix &&
        normalized !== input.requiredPrefix &&
        !normalized.startsWith(`${input.requiredPrefix}/`)
      ) {
        throw new FilesPathError("Invalid path", {
          code: "invalid_path",
          statusCode: 400,
        });
      }

      return {
        rootPath: mockDataRoot,
        relativePath: normalized,
        absolutePath: path.resolve(mockDataRoot, normalized),
        segments: normalized ? normalized.split("/") : [],
        exists: true,
      };
    }),
  };
});

vi.mock("@/lib/server/modules/files/local-shares-repository", () => ({
  listLocalSharesFromDb: vi.fn(),
  getLocalShareFromDb: vi.fn(),
  getLocalShareBySourcePathFromDb: vi.fn(),
  insertLocalShareInDb: vi.fn(),
  deleteLocalShareFromDb: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

import { execFile } from "node:child_process";
import {
  addLocalFolderShare,
  removeLocalFolderShare,
  type LocalSharingError,
} from "@/lib/server/modules/files/local-sharing";
import {
  deleteLocalShareFromDb,
  getLocalShareBySourcePathFromDb,
  getLocalShareFromDb,
  insertLocalShareInDb,
} from "@/lib/server/modules/files/local-shares-repository";

type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

function getExecInvocation(restArgs: unknown[]) {
  const callback = restArgs.at(-1);
  if (typeof callback !== "function") {
    throw new Error("Missing execFile callback");
  }
  const args = Array.isArray(restArgs[0]) ? (restArgs[0] as string[]) : [];
  return {
    args,
    callback: callback as ExecFileCallback,
  };
}

function uniqueViolation(constraint: string, detail: string) {
  const error = new Error("duplicate key value violates unique constraint") as Error & {
    code?: string;
    constraint?: string;
    detail?: string;
  };
  error.code = "23505";
  error.constraint = constraint;
  error.detail = detail;
  return error;
}

describe("local sharing service", () => {
  beforeEach(async () => {
    mockDataRoot = await mkdtemp(path.join(os.tmpdir(), "home-server-local-sharing-"));
    await mkdir(path.join(mockDataRoot, "Media"), { recursive: true });
    await mkdir(path.join(mockDataRoot, "Shared"), { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (mockDataRoot) {
      await rm(mockDataRoot, { recursive: true, force: true });
    }
  });

  it("rolls back reserved share and deletes db row when mount fails", async () => {
    const reserved = {
      id: "local-1",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(getLocalShareBySourcePathFromDb).mockResolvedValueOnce(null);
    vi.mocked(insertLocalShareInDb).mockResolvedValueOnce(reserved);
    vi.mocked(deleteLocalShareFromDb).mockResolvedValueOnce(reserved);

    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "mountpoint") {
        const error = new Error("not mounted") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "not mounted";
        callback(error, "", "not mounted");
        return {} as never;
      }

      if (command === "mount") {
        const error = new Error("mount failed") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "permission denied";
        callback(error, "", "permission denied");
        return {} as never;
      }

      if (command === "net" && args[0] === "usershare" && args[1] === "delete") {
        const error = new Error("does not exist") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "usershare does not exist";
        callback(error, "", "usershare does not exist");
        return {} as never;
      }

      if (command === "umount") {
        const error = new Error("not mounted") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "not mounted";
        callback(error, "", "not mounted");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    await expect(
      addLocalFolderShare({
        path: "Media",
      }),
    ).rejects.toMatchObject<Partial<LocalSharingError>>({
      code: "permission_denied",
      statusCode: 403,
    });

    expect(deleteLocalShareFromDb).toHaveBeenCalledWith("local-1");
  });

  it("maps source-path unique conflict to share_exists", async () => {
    vi.mocked(getLocalShareBySourcePathFromDb).mockResolvedValueOnce(null);
    vi.mocked(insertLocalShareInDb).mockRejectedValueOnce(
      uniqueViolation(
        "files_local_shares_source_path_idx",
        "Key (source_path)=(Media) already exists.",
      ),
    );

    await expect(
      addLocalFolderShare({
        path: "Media",
      }),
    ).rejects.toMatchObject<Partial<LocalSharingError>>({
      code: "share_exists",
      statusCode: 409,
    });

    expect(execFile).not.toHaveBeenCalled();
  });

  it("retries share-name conflicts and succeeds", async () => {
    vi.mocked(getLocalShareBySourcePathFromDb).mockResolvedValue(null);
    vi.mocked(insertLocalShareInDb)
      .mockRejectedValueOnce(
        uniqueViolation(
          "files_local_shares_share_name_idx",
          "Key (share_name)=(Media) already exists.",
        ),
      )
      .mockResolvedValueOnce({
        id: "local-2",
        shareName: "Media-2",
        sourcePath: "Media",
        sharedPath: "Shared/Media-2",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "mountpoint") {
        const error = new Error("not mounted") as Error & { code?: number };
        error.code = 1;
        callback(error, "", "");
        return {} as never;
      }

      if (command === "mount") {
        callback(null, "", "");
        return {} as never;
      }

      if (command === "net" && args[0] === "usershare" && args[1] === "add") {
        callback(null, "", "");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    const result = await addLocalFolderShare({
      path: "Media",
      name: "Media",
    });

    expect(result.shareName).toBe("Media-2");
    expect(insertLocalShareInDb).toHaveBeenCalledTimes(2);
  });

  it("removes shared folder idempotently when usershare/mount are absent", async () => {
    vi.mocked(getLocalShareFromDb).mockResolvedValueOnce({
      id: "local-1",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deleteLocalShareFromDb).mockResolvedValueOnce({
      id: "local-1",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "net" && args[0] === "usershare" && args[1] === "delete") {
        const error = new Error("usershare does not exist") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "usershare does not exist";
        callback(error, "", "usershare does not exist");
        return {} as never;
      }

      if (command === "umount") {
        const error = new Error("not mounted") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "not mounted";
        callback(error, "", "not mounted");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    const result = await removeLocalFolderShare("local-1");
    expect(result.removed).toBe(true);
    expect(deleteLocalShareFromDb).toHaveBeenCalledWith("local-1");
  });

  it("skips umount when share is already unmounted", async () => {
    vi.mocked(getLocalShareFromDb).mockResolvedValueOnce({
      id: "local-2",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deleteLocalShareFromDb).mockResolvedValueOnce({
      id: "local-2",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "net" && args[0] === "usershare" && args[1] === "info") {
        const error = new Error("usershare does not exist") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "usershare does not exist";
        callback(error, "", "usershare does not exist");
        return {} as never;
      }

      if (command === "mountpoint") {
        const error = new Error("not mounted") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "not mounted";
        callback(error, "", "not mounted");
        return {} as never;
      }

      if (command === "umount") {
        callback(new Error("should not call umount"), "", "should not call umount");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    const result = await removeLocalFolderShare("local-2");

    expect(result.removed).toBe(true);
    expect(deleteLocalShareFromDb).toHaveBeenCalledWith("local-2");
    expect(execFile).not.toHaveBeenCalledWith(
      "umount",
      expect.any(Array),
      expect.any(Function),
    );
  });

  it("removes stale db record when usershare delete is permission-denied but mount is absent", async () => {
    vi.mocked(getLocalShareFromDb).mockResolvedValueOnce({
      id: "local-usershare-perm",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deleteLocalShareFromDb).mockResolvedValueOnce({
      id: "local-usershare-perm",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let usershareInfoCalls = 0;
    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "mountpoint") {
        const error = new Error("not mounted") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "not mounted";
        callback(error, "", "not mounted");
        return {} as never;
      }

      if (command === "net" && args[0] === "usershare" && args[1] === "info") {
        usershareInfoCalls += 1;
        callback(null, "share present", "");
        return {} as never;
      }

      if (command === "net" && args[0] === "usershare" && args[1] === "delete") {
        const error = new Error("permission denied") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "permission denied";
        callback(error, "", "permission denied");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    const result = await removeLocalFolderShare("local-usershare-perm");

    expect(result.removed).toBe(true);
    expect(deleteLocalShareFromDb).toHaveBeenCalledWith("local-usershare-perm");
    expect(usershareInfoCalls).toBeGreaterThanOrEqual(1);
  });

  it("falls back to lazy umount when unmount target is busy", async () => {
    vi.mocked(getLocalShareFromDb).mockResolvedValueOnce({
      id: "local-3",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deleteLocalShareFromDb).mockResolvedValueOnce({
      id: "local-3",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "net" && args[0] === "usershare" && args[1] === "info") {
        callback(null, "share present", "");
        return {} as never;
      }

      if (command === "mountpoint") {
        callback(null, "", "");
        return {} as never;
      }

      if (command === "net" && args[0] === "usershare" && args[1] === "delete") {
        callback(null, "", "");
        return {} as never;
      }

      if (command === "umount" && args[0] === "-l") {
        callback(null, "", "");
        return {} as never;
      }

      if (command === "umount") {
        const error = new Error("target is busy") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 32;
        error.stderr = "target is busy";
        callback(error, "", "target is busy");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    const result = await removeLocalFolderShare("local-3");

    expect(result.removed).toBe(true);
    expect(deleteLocalShareFromDb).toHaveBeenCalledWith("local-3");
    expect(execFile).toHaveBeenCalledWith(
      "umount",
      ["-l", expect.stringContaining("Shared/Media")],
      expect.anything(),
      expect.any(Function),
    );
  });

  it("removes db record when cleanup command fails but share is already inactive", async () => {
    vi.mocked(getLocalShareFromDb).mockResolvedValueOnce({
      id: "local-4",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deleteLocalShareFromDb).mockResolvedValueOnce({
      id: "local-4",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Shared/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let mountpointCallCount = 0;
    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "net" && args[0] === "usershare" && args[1] === "info") {
        const error = new Error("usershare does not exist") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "usershare does not exist";
        callback(error, "", "usershare does not exist");
        return {} as never;
      }

      if (command === "mountpoint") {
        mountpointCallCount += 1;
        if (mountpointCallCount === 1) {
          callback(null, "", "");
          return {} as never;
        }
        const error = new Error("not mounted") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "not mounted";
        callback(error, "", "not mounted");
        return {} as never;
      }

      if (command === "umount") {
        const error = new Error("permission denied") as Error & {
          code?: number;
          stderr?: string;
        };
        error.code = 1;
        error.stderr = "permission denied";
        callback(error, "", "permission denied");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    const result = await removeLocalFolderShare("local-4");

    expect(result.removed).toBe(true);
    expect(deleteLocalShareFromDb).toHaveBeenCalledWith("local-4");
  });

  it("removes stale db record when shared path is no longer valid", async () => {
    vi.mocked(getLocalShareFromDb).mockResolvedValueOnce({
      id: "local-stale",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Network/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(deleteLocalShareFromDb).mockResolvedValueOnce({
      id: "local-stale",
      shareName: "Media",
      sourcePath: "Media",
      sharedPath: "Network/Media",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await removeLocalFolderShare("local-stale");

    expect(result.removed).toBe(true);
    expect(deleteLocalShareFromDb).toHaveBeenCalledWith("local-stale");
  });

  it("serializes concurrent add requests for the same source path", async () => {
    let sourceReserved = false;

    vi.mocked(getLocalShareBySourcePathFromDb).mockImplementation(async () => {
      if (!sourceReserved) return null;
      return {
        id: "local-1",
        shareName: "Media",
        sourcePath: "Media",
        sharedPath: "Shared/Media",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    vi.mocked(insertLocalShareInDb).mockImplementation(async (input) => {
      if (sourceReserved) {
        throw uniqueViolation(
          "files_local_shares_source_path_idx",
          "Key (source_path)=(Media) already exists.",
        );
      }
      sourceReserved = true;
      return {
        id: input.id,
        shareName: input.shareName,
        sourcePath: input.sourcePath,
        sharedPath: input.sharedPath,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    vi.mocked(execFile).mockImplementation((command: string, ...restArgs: unknown[]) => {
      const { args, callback } = getExecInvocation(restArgs);

      if (command === "mountpoint") {
        const error = new Error("not mounted") as Error & { code?: number };
        error.code = 1;
        callback(error, "", "");
        return {} as never;
      }

      if (command === "mount") {
        setTimeout(() => callback(null, "", ""), 30);
        return {} as never;
      }

      if (command === "net" && args[0] === "usershare" && args[1] === "add") {
        callback(null, "", "");
        return {} as never;
      }

      callback(null, "", "");
      return {} as never;
    });

    const results = await Promise.allSettled([
      addLocalFolderShare({ path: "Media" }),
      addLocalFolderShare({ path: "Media" }),
    ]);

    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof addLocalFolderShare>>> =>
        result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      code: "share_exists",
      statusCode: 409,
    });
  });
});
