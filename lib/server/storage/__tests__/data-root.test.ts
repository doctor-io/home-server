import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const { serverEnvMock } = vi.hoisted(() => ({
  serverEnvMock: {
    STORE_STACKS_ROOT: "/var/lib/home-server/stacks",
    STORE_APP_DATA_ROOT: "/DATA/AppData",
  },
}));

vi.mock("@/lib/server/env", () => ({
  serverEnv: serverEnvMock,
}));

describe("data-root storage resolution", () => {
  it("preserves the configured stacks root when the resolved data root matches the primary root", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
    }));

    const dataRootModule = await import("@/lib/server/storage/data-root");

    await dataRootModule.ensureDataRootDirectories();

    expect(dataRootModule.resolveStoreStacksRoot()).toBe(
      "/var/lib/home-server/stacks",
    );
  });

  it("falls back to a CWD-relative DATA root when the primary root cannot be created", async () => {
    vi.resetModules();
    vi.doMock("node:fs/promises", () => ({
      mkdir: vi
        .fn()
        .mockRejectedValueOnce(new Error("permission denied"))
        .mockResolvedValue(undefined),
    }));

    const dataRootModule = await import("@/lib/server/storage/data-root");

    await dataRootModule.ensureDataRootDirectories();

    // Fallback resolves to <cwd>/DATA/Apps (since configured stacks root doesn't match fallback)
    expect(dataRootModule.resolveStoreStacksRoot()).toBe(
      path.join(process.cwd(), "DATA", "Apps"),
    );
  });
});
