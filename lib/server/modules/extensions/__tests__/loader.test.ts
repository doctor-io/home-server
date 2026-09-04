import { beforeEach, describe, expect, it, vi } from "vitest";

// hoisted: vi.mock is lifted above the file, so its factory cannot close over
// a plain top-level const.
const env = vi.hoisted(() => ({
  HOMEIO_EXTENSIONS_ENTRY: undefined as string | undefined,
}));

vi.mock("@/lib/server/env", () => ({ serverEnv: env }));

import {
  loadExtensions,
  resetExtensionsLoader,
} from "@/lib/server/modules/extensions/loader";
import {
  listExtensionRoutes,
  resetExtensionRoutes,
} from "@/lib/server/modules/extensions/route-registry";

describe("extensions loader", () => {
  beforeEach(() => {
    env.HOMEIO_EXTENSIONS_ENTRY = undefined;
    resetExtensionRoutes();
    resetExtensionsLoader();
  });

  it("registers nothing when no entry is configured", async () => {
    await loadExtensions();

    expect(listExtensionRoutes()).toEqual([]);
  });

  it("calls register() on the configured entry", async () => {
    env.HOMEIO_EXTENSIONS_ENTRY =
      "@/lib/server/modules/extensions/__tests__/fixtures/entry";

    await loadExtensions();

    expect(listExtensionRoutes().map((route) => route.path)).toEqual([
      "fixture/ping",
    ]);
  });

  it("keeps booting when the entry cannot be loaded", async () => {
    env.HOMEIO_EXTENSIONS_ENTRY = "@/does/not/exist";

    await expect(loadExtensions()).resolves.toBeUndefined();
    expect(listExtensionRoutes()).toEqual([]);
  });

  it("loads at most once per process", async () => {
    env.HOMEIO_EXTENSIONS_ENTRY =
      "@/lib/server/modules/extensions/__tests__/fixtures/entry";

    await loadExtensions();
    // A second call must not re-register and trip the duplicate guard.
    await expect(loadExtensions()).resolves.toBeUndefined();
    expect(listExtensionRoutes()).toHaveLength(1);
  });
});
