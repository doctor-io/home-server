import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..");
const SOURCE_ROOTS = ["app", "components", "hooks", "lib", "modules"];
const FEATURE_MODULES = [
  "modules/apps",
  "modules/files",
  "modules/settings",
  "modules/system",
];
const SOURCE_FILE_PATTERN = /\.(ts|tsx)$/;
const CURRENT_TEST_FILE = join(
  REPO_ROOT,
  "modules",
  "__tests__",
  "architecture-boundaries.test.ts",
);

function isTestFile(filePath: string) {
  return (
    filePath.includes("/__tests__/") ||
    filePath.endsWith(".test.ts") ||
    filePath.endsWith(".test.tsx")
  );
}

function listSourceFiles(root: string): string[] {
  const entries = readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...listSourceFiles(entryPath));
      continue;
    }

    if (SOURCE_FILE_PATTERN.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function readImports(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

describe("module boundaries", () => {
  it("does not import feature code from the legacy desktop bucket", () => {
    const files = SOURCE_ROOTS
      .flatMap((root) => listSourceFiles(join(REPO_ROOT, root)))
      .filter((filePath) => filePath !== CURRENT_TEST_FILE);

    const offenders = files.filter((filePath) =>
      readImports(filePath).includes('from "@/components/desktop/')
    );

    expect(offenders).toEqual([]);
  });

  it("keeps feature modules independent from shell internals", () => {
    const files = FEATURE_MODULES.flatMap((root) => listSourceFiles(join(REPO_ROOT, root)));

    const offenders = files.filter((filePath) =>
      readImports(filePath).includes('from "@/modules/shell/')
    );

    expect(offenders).toEqual([]);
  });

  it("keeps feature-owned hooks out of the top-level hooks bucket", () => {
    const files = SOURCE_ROOTS
      .flatMap((root) => listSourceFiles(join(REPO_ROOT, root)))
      .filter((filePath) => filePath !== CURRENT_TEST_FILE);

    const offenders = files.filter((filePath) => {
      const source = readImports(filePath);

      return (
        source.includes('from "@/hooks/useInstalledApps"') ||
        source.includes('from "@/hooks/useStoreActions"') ||
        source.includes('from "@/hooks/useStoreApp"') ||
        source.includes('from "@/hooks/useStoreCatalog"') ||
        source.includes('from "@/hooks/useStoreOperation"') ||
        source.includes('from "@/hooks/useFiles"') ||
        source.includes('from "@/hooks/useLocalFolderShares"') ||
        source.includes('from "@/hooks/useNetworkShares"') ||
        source.includes('from "@/hooks/useTrashActions"') ||
        source.includes('from "@/hooks/useSettingsBackend"') ||
        source.includes('from "@/hooks/useDesktopAppearance"') ||
        source.includes('from "@/hooks/useRebootRecovery"') ||
        source.includes('from "@/hooks/useTerminalCommand"') ||
        source.includes('from "@/hooks/useCurrentWeather"') ||
        source.includes('from "@/hooks/useDockerInfo"') ||
        source.includes('from "@/hooks/useDockerStats"') ||
        source.includes('from "@/hooks/useNetworkActions"') ||
        source.includes('from "@/hooks/useNetworkEventsSse"') ||
        source.includes('from "@/hooks/useNetworkStatus"') ||
        source.includes('from "@/hooks/useSystemMetrics"') ||
        source.includes('from "@/hooks/useSystemSse"') ||
        source.includes('from "@/hooks/useSystemUpdateStatus"') ||
        source.includes('from "@/hooks/useUserLocation"') ||
        source.includes('from "@/hooks/useWifiNetworks"')
      );
    });

    expect(offenders).toEqual([]);
  });

  it("keeps feature modules independent from app api routes", () => {
    const files = FEATURE_MODULES
      .flatMap((root) => listSourceFiles(join(REPO_ROOT, root)))
      .filter((filePath) => !isTestFile(filePath));

    const offenders = files.filter((filePath) => readImports(filePath).includes('from "@/app/api/'));

    expect(offenders).toEqual([]);
  });

  it("keeps app api routes away from feature ui modules", () => {
    const files = listSourceFiles(join(REPO_ROOT, "app", "api")).filter(
      (filePath) => !isTestFile(filePath),
    );

    const offenders = files.filter((filePath) =>
      readImports(filePath).includes('from "@/modules/'),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps components/desktop limited to tests during the migration", () => {
    const desktopRoot = join(REPO_ROOT, "components", "desktop");
    const offenders = listSourceFiles(desktopRoot).filter(
      (filePath) =>
        !filePath.includes("/__tests__/") &&
        !filePath.endsWith(".test.ts") &&
        !filePath.endsWith(".test.tsx"),
    );

    expect(offenders).toEqual([]);
  });

  /**
   * Snapshot of api/v1 route files that, as of v1.7, do not call
   * authenticateSession. These pre-exist this guard and are intentionally
   * left for incremental hardening in later versions. Adding a NEW route
   * without auth must fail the test below; the allowlist should only ever
   * shrink — never grow.
   */
  const V1_AUTH_ALLOWLIST = new Set<string>([
    "app/api/v1/apps/[appId]/check-updates/route.ts",
    "app/api/v1/apps/[appId]/logs/stream/route.ts",
    "app/api/v1/apps/[appId]/restart/route.ts",
    "app/api/v1/apps/[appId]/start/route.ts",
    "app/api/v1/apps/[appId]/stop/route.ts",
    "app/api/v1/apps/route.ts",
    "app/api/v1/docker/info/route.ts",
    "app/api/v1/docker/stats/route.ts",
    "app/api/v1/files/asset/route.ts",
    "app/api/v1/files/content/route.ts",
    "app/api/v1/files/download/route.ts",
    "app/api/v1/files/google-drive/auth/route.ts",
    "app/api/v1/files/google-drive/callback/route.ts",
    "app/api/v1/files/google-drive/connections/[id]/route.ts",
    "app/api/v1/files/google-drive/connections/route.ts",
    "app/api/v1/files/network/discover/servers/route.ts",
    "app/api/v1/files/network/discover/shares/route.ts",
    "app/api/v1/files/network/shares/[shareId]/mount/route.ts",
    "app/api/v1/files/network/shares/[shareId]/route.ts",
    "app/api/v1/files/network/shares/[shareId]/unmount/route.ts",
    "app/api/v1/files/network/shares/route.ts",
    "app/api/v1/files/ops/route.ts",
    "app/api/v1/files/root/route.ts",
    "app/api/v1/files/route.ts",
    "app/api/v1/files/search/route.ts",
    "app/api/v1/files/shared/folders/[shareId]/route.ts",
    "app/api/v1/files/shared/folders/route.ts",
    "app/api/v1/files/starred/route.ts",
    "app/api/v1/files/trash/delete/route.ts",
    "app/api/v1/files/trash/empty/route.ts",
    "app/api/v1/files/trash/move/route.ts",
    "app/api/v1/files/trash/restore/route.ts",
    "app/api/v1/files/upload/route.ts",
    "app/api/v1/files/usb/[driveId]/eject/route.ts",
    "app/api/v1/files/usb/[driveId]/mount/route.ts",
    "app/api/v1/files/usb/[driveId]/unmount/route.ts",
    "app/api/v1/files/usb/route.ts",
    "app/api/v1/files/usb/stream/route.ts",
    "app/api/v1/files/zip/route.ts",
    "app/api/v1/logs/route.ts",
    "app/api/v1/network/connect/route.ts",
    "app/api/v1/network/disconnect/route.ts",
    "app/api/v1/network/events/stream/route.ts",
    "app/api/v1/network/networks/route.ts",
    "app/api/v1/network/status/route.ts",
    "app/api/v1/notifications/read-all/route.ts",
    "app/api/v1/notifications/route.ts",
    "app/api/v1/notifications/stream/route.ts",
    "app/api/v1/settings/appearance/route.ts",
    "app/api/v1/store/apps/[appId]/compose/route.ts",
    "app/api/v1/store/apps/[appId]/install/route.ts",
    "app/api/v1/store/apps/[appId]/redeploy/route.ts",
    "app/api/v1/store/apps/[appId]/route.ts",
    "app/api/v1/store/apps/[appId]/settings/route.ts",
    "app/api/v1/store/apps/[appId]/uninstall/route.ts",
    "app/api/v1/store/apps/[appId]/update/route.ts",
    "app/api/v1/store/apps/route.ts",
    "app/api/v1/store/check-updates/route.ts",
    "app/api/v1/store/custom-apps/install/route.ts",
    "app/api/v1/store/operations/[operationId]/route.ts",
    "app/api/v1/store/sources/[sourceId]/refresh/route.ts",
    "app/api/v1/store/sources/[sourceId]/route.ts",
    "app/api/v1/store/sources/route.ts",
    "app/api/v1/system/metrics/route.ts",
    "app/api/v1/terminal/execute/route.ts",
  ]);

  const HTTP_HANDLER_PATTERN =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/;

  it("requires authenticateSession in every new app/api/v1/** route handler", () => {
    const v1Root = join(REPO_ROOT, "app", "api", "v1");
    const routeFiles = listSourceFiles(v1Root)
      .filter((filePath) => !isTestFile(filePath))
      .filter((filePath) => filePath.endsWith("/route.ts"));

    const offenders: string[] = [];
    const staleAllowlistEntries: string[] = [];

    for (const filePath of routeFiles) {
      const source = readImports(filePath);
      if (!HTTP_HANDLER_PATTERN.test(source)) continue;

      const relativePath = filePath.slice(REPO_ROOT.length + 1);
      const hasAuth = source.includes("authenticateSession");
      const allowlisted = V1_AUTH_ALLOWLIST.has(relativePath);

      if (!hasAuth && !allowlisted) {
        offenders.push(relativePath);
      }
      if (hasAuth && allowlisted) {
        // A previously-unauthenticated route now calls authenticateSession;
        // it should be removed from V1_AUTH_ALLOWLIST so the snapshot keeps
        // shrinking.
        staleAllowlistEntries.push(relativePath);
      }
    }

    expect(offenders, "new v1 routes must call authenticateSession").toEqual([]);
    expect(
      staleAllowlistEntries,
      "remove these from V1_AUTH_ALLOWLIST — they now authenticate",
    ).toEqual([]);
  });
});
