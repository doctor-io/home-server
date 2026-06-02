import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const publicRoutes = new Set([
  "files/google-drive/auth/route.ts",
  "files/google-drive/callback/route.ts",
  // A8: second step of two-factor login. The caller has a valid partial-auth
  // token (issued by /api/auth/login) but no session yet — that's the whole
  // reason this endpoint exists.
  "auth/login/totp/route.ts",
]);

function findRouteFiles(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return findRouteFiles(entryPath, root);
    }

    if (entry.name !== "route.ts") return [];
    return [path.relative(root, entryPath)];
  });
}

describe("api v1 auth architecture", () => {
  it("requires the shared API session helper on every non-public route", () => {
    const apiRoot = path.join(process.cwd(), "app/api/v1");
    const missingAuth = findRouteFiles(apiRoot)
      .filter((file) => !publicRoutes.has(file))
      .filter((file) => {
        const content = readFileSync(path.join(apiRoot, file), "utf8");
        return !content.includes("requireApiSession");
      });

    expect(missingAuth).toEqual([]);
  });
});
