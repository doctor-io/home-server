import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Every route a bearer token can reach, and the scope it demands.
 *
 * A route without an entry here refuses tokens outright — requireApiSession
 * only considers one when the route names a scope. This snapshot exists so
 * that widening the token-accessible surface is a deliberate edit somebody
 * reviews, not a side effect of copying an existing route.
 */
const TOKEN_ACCESSIBLE_ROUTES: Record<string, string> = {
  "system/metrics/route.ts": "read:metrics",
  "apps/route.ts": "read:apps",
  "apps/[appId]/start/route.ts": "write:apps",
  "apps/[appId]/stop/route.ts": "write:apps",
  "apps/[appId]/restart/route.ts": "write:apps",
  "system/power/shutdown/route.ts": "system:power",
  "system/power/reboot/route.ts": "system:power",
};

function findRouteFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return findRouteFiles(entryPath, root);
    if (entry.name !== "route.ts") return [];
    return [path.relative(root, entryPath)];
  });
}

function scopeIn(source: string): string | null {
  const match = source.match(/requireApiSession\(\s*request\s*,\s*\{\s*scope:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

describe("api v1 token scopes", () => {
  const apiRoot = path.join(process.cwd(), "app/api/v1");

  it("only the reviewed routes accept a bearer token", () => {
    const scoped: Record<string, string> = {};

    for (const file of findRouteFiles(apiRoot)) {
      const scope = scopeIn(readFileSync(path.join(apiRoot, file), "utf8"));
      if (scope) scoped[file.split(path.sep).join("/")] = scope;
    }

    expect(scoped).toEqual(TOKEN_ACCESSIBLE_ROUTES);
  });

  it("power stays behind its own scope, never write:apps", () => {
    // Stopping a container and shutting down the host are different questions,
    // and a token granted the first must not answer the second.
    for (const [file, scope] of Object.entries(TOKEN_ACCESSIBLE_ROUTES)) {
      if (file.includes("system/power")) expect(scope).toBe("system:power");
    }
  });

  it("no file route is token-accessible yet", () => {
    // read:files and write:files exist as scopes but are wired to nothing.
    // Listing a file route here should be a deliberate decision.
    const fileRoutes = Object.keys(TOKEN_ACCESSIBLE_ROUTES).filter((file) =>
      file.startsWith("files/"),
    );

    expect(fileRoutes).toEqual([]);
  });
});
