import "server-only";

import { serverEnv } from "@/lib/server/env";
import { logServerAction } from "@/lib/server/logging/logger";
import { listExtensionRoutes } from "@/lib/server/modules/extensions/route-registry";

/**
 * The module named by HOMEIO_EXTENSIONS_ENTRY is expected to export
 * `register()`, and to call registerExtensionRoutes from it.
 */
type ExtensionsEntry = {
  register?: () => void | Promise<void>;
};

let loaded = false;

/**
 * Loads the optional extensions bundle. A no-op unless
 * HOMEIO_EXTENSIONS_ENTRY is set, so a stock install never looks for one.
 *
 * The specifier is resolved at runtime rather than bundled: the module lives
 * outside this repo, so the bundler must not try to follow it.
 */
export async function loadExtensions(): Promise<void> {
  if (loaded) return;
  loaded = true;

  const entry = serverEnv.HOMEIO_EXTENSIONS_ENTRY;
  if (!entry) {
    logServerAction({
      level: "debug",
      layer: "system",
      action: "extensions.load",
      status: "success",
      meta: { configured: false },
    });
    return;
  }

  try {
    const bundle: ExtensionsEntry = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ entry
    );
    await bundle.register?.();

    logServerAction({
      level: "info",
      layer: "system",
      action: "extensions.load",
      status: "success",
      meta: { entry, routes: listExtensionRoutes().length },
    });
  } catch (error) {
    // A broken bundle must not stop the server booting: the core keeps
    // serving, and the log says exactly what failed to load.
    logServerAction({
      level: "error",
      layer: "system",
      action: "extensions.load",
      status: "error",
      meta: {
        entry,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}

/** Test-only: the loader runs once per process in production. */
export function resetExtensionsLoader(): void {
  loaded = false;
}
