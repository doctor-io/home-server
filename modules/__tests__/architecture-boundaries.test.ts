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
});
