import { lstat, mkdtemp, rm } from "node:fs/promises";
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

  it("ensures reserved directories before resolving paths", async () => {
    const { resolvePathWithinFilesRoot } = await import(
      "@/lib/server/modules/files/path-resolver"
    );

    const resolved = await resolvePathWithinFilesRoot({
      inputPath: "Trash",
      allowHiddenSegments: true,
    });

    expect(resolved.relativePath).toBe("Trash");
    expect(resolved.exists).toBe(true);

    const info = await lstat(path.join(tempRoot, "Trash"));
    expect(info.isDirectory()).toBe(true);
  });
});
