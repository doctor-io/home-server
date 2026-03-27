import { lstat, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = process.env;

let tempRoot = "";

describe("path resolver", () => {
  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "home-server-files-root-"));
    process.env.FILES_ROOT = tempRoot;
  });

  afterEach(async () => {
    process.env = originalEnv;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("maps virtual reserved directories to hidden on-disk folders", async () => {
    const { resolvePathWithinFilesRoot } = await import(
      "@/lib/server/modules/files/path-resolver"
    );

    const resolved = await resolvePathWithinFilesRoot({
      inputPath: "Trash",
      allowHiddenSegments: true,
    });

    expect(resolved.relativePath).toBe("Trash");
    expect(resolved.exists).toBe(true);
    expect(resolved.absolutePath).toBe(await realpath(path.join(tempRoot, ".Trash")));

    const info = await lstat(path.join(tempRoot, ".Trash"));
    expect(info.isDirectory()).toBe(true);
  });

  it("migrates legacy visible internal folders to hidden folders", async () => {
    await mkdir(path.join(tempRoot, "Trash"), { recursive: true });
    await writeFile(path.join(tempRoot, "Trash", "notes.txt"), "hello", "utf8");

    const { resolvePathWithinFilesRoot } = await import(
      "@/lib/server/modules/files/path-resolver"
    );

    const resolved = await resolvePathWithinFilesRoot({
      inputPath: "Trash/notes.txt",
      allowHiddenSegments: true,
    });

    expect(resolved.absolutePath).toBe(
      await realpath(path.join(tempRoot, ".Trash", "notes.txt")),
    );
    expect(await readFile(resolved.absolutePath, "utf8")).toBe("hello");
    await expect(lstat(path.join(tempRoot, "Trash"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("removes an empty legacy visible internal folder when hidden root already exists", async () => {
    await mkdir(path.join(tempRoot, ".Shared"), { recursive: true });
    await mkdir(path.join(tempRoot, "Shared"), { recursive: true });

    const { ensureFilesRootDirectories } = await import(
      "@/lib/server/modules/files/path-resolver"
    );

    await ensureFilesRootDirectories();

    await expect(lstat(path.join(tempRoot, "Shared"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    const hiddenInfo = await lstat(path.join(tempRoot, ".Shared"));
    expect(hiddenInfo.isDirectory()).toBe(true);
  });
});
