import "server-only";

import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { LruCache } from "@/lib/server/cache/lru";
import { serverEnv } from "@/lib/server/env";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import { ensureDataRootDirectories } from "@/lib/server/storage/data-root";
import {
  type AppDefinition,
  parseComposeToApp,
} from "@/lib/server/modules/store/casaos-compose-mapper";
import {
  readStoreCatalogConfig,
  resolveStoreCatalogsRoot,
  writeStoreCatalogConfig,
} from "@/lib/server/modules/store/catalog-config";

const execFileAsync = promisify(execFile);

export const CASAOS_APPSTORE_REPO_URL = "https://github.com/IceWhaleTech/CasaOS-AppStore";
const CASAOS_REPO_DIRNAME = "CasaOS-AppStore";
const APPS_DIRECTORY_CANDIDATES = ["Apps", "Store"] as const;

type CasaosCategoryEntry = {
  name?: unknown;
  description?: unknown;
};

type CasaosAppReference = {
  appid?: unknown;
};

export type StoreCatalogTemplate = AppDefinition;

export type StoreCatalogCategory = {
  id: string;
  name: string;
  description: string;
  appCount: number;
};

export type StoreCatalogSnapshot = {
  apps: StoreCatalogTemplate[];
  categories: StoreCatalogCategory[];
  featuredAppIds: string[];
  recommendedAppIds: string[];
  sourcePath: string;
};

type CacheEntry = {
  signature: string;
  snapshot: StoreCatalogSnapshot;
};

const catalogCache = new LruCache<CacheEntry>(1, serverEnv.STORE_CATALOG_TTL_MS);

function normalizeCategoryId(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function defaultCatalogPath() {
  return path.join(resolveStoreCatalogsRoot(), CASAOS_REPO_DIRNAME);
}

async function resolveConfiguredCatalogPath() {
  await ensureDataRootDirectories();
  const config = await readStoreCatalogConfig();
  return config?.defaultCatalogPath ?? defaultCatalogPath();
}

async function ensureCasaosCatalogRepo(targetPath: string) {
  const absoluteTarget = path.resolve(targetPath);
  const appsDir = await resolveAppsDirectory(absoluteTarget).catch(() => null);
  if (appsDir) {
    return absoluteTarget;
  }

  await ensureDataRootDirectories();
  await mkdir(path.dirname(absoluteTarget), { recursive: true });

  if (!existsSync(absoluteTarget)) {
    await execFileAsync("git", ["clone", "--depth=1", CASAOS_APPSTORE_REPO_URL, absoluteTarget]);
  } else if (existsSync(path.join(absoluteTarget, ".git"))) {
    await execFileAsync("git", ["-C", absoluteTarget, "pull", "--ff-only"]);
  }

  await writeStoreCatalogConfig({
    defaultCatalogPath: absoluteTarget,
    repoUrl: CASAOS_APPSTORE_REPO_URL,
  });

  return absoluteTarget;
}

async function resolveAppsDirectory(repoPath: string) {
  for (const candidate of APPS_DIRECTORY_CANDIDATES) {
    const fullPath = path.join(repoPath, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(`CasaOS catalog apps directory not found in ${repoPath}`);
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function collectComposePaths(appsDirectory: string) {
  const entries = await readdir(appsDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(appsDirectory, entry.name, "docker-compose.yml"))
    .filter((composePath) => existsSync(composePath))
    .sort((left, right) => left.localeCompare(right));
}

async function buildSignature(repoPath: string, composePaths: string[]) {
  const watchedFiles = [
    path.join(repoPath, "category-list.json"),
    path.join(repoPath, "featured-apps.json"),
    path.join(repoPath, "recommend-list.json"),
    ...composePaths,
  ];

  const parts = await Promise.all(
    watchedFiles.map(async (filePath) => {
      try {
        const info = await stat(filePath);
        return `${filePath}:${info.mtimeMs}:${info.size}`;
      } catch {
        return `${filePath}:missing`;
      }
    }),
  );

  return parts.join("|");
}

function mapCatalogApp(input: AppDefinition, repoPath: string): StoreCatalogTemplate {
  return {
    ...input,
    repositoryUrl: CASAOS_APPSTORE_REPO_URL,
    stackFile: path.relative(repoPath, input.composePath),
  };
}

function buildCatalogCategories(input: {
  apps: StoreCatalogTemplate[];
  categoryEntries: CasaosCategoryEntry[];
  includeCustomCategory?: boolean;
}) {
  const counts = new Map<string, number>();
  for (const app of input.apps) {
    for (const category of app.categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  const ordered: StoreCatalogCategory[] = [];
  for (const item of input.categoryEntries) {
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    ordered.push({
      id: normalizeCategoryId(name),
      name,
      description:
        typeof item.description === "string" && item.description.trim().length > 0
          ? item.description.trim()
          : `${name} apps`,
      appCount: counts.get(name) ?? 0,
    });
  }

  const known = new Set(ordered.map((item) => item.name));
  for (const [name, appCount] of Array.from(counts.entries()).sort((left, right) =>
    left[0].localeCompare(right[0]),
  )) {
    if (known.has(name)) continue;
    ordered.push({
      id: normalizeCategoryId(name),
      name,
      description: `${name} apps`,
      appCount,
    });
  }

  if (input.includeCustomCategory && !ordered.some((item) => item.name === "Custom")) {
    ordered.push({
      id: normalizeCategoryId("Custom"),
      name: "Custom",
      description: "Custom compose apps",
      appCount: counts.get("Custom") ?? 0,
    });
  }

  return ordered.filter((item) => item.appCount > 0);
}

function normalizeReferences(entries: CasaosAppReference[]) {
  return entries
    .map((entry) => (typeof entry.appid === "string" ? entry.appid.trim() : ""))
    .filter((appid) => appid.length > 0);
}

async function buildStoreCatalogSnapshot(repoPath: string): Promise<StoreCatalogSnapshot> {
  const appsDirectory = await resolveAppsDirectory(repoPath);
  const composePaths = await collectComposePaths(appsDirectory);
  const signature = await buildSignature(repoPath, composePaths);
  const cached = catalogCache.get("casaos-catalog");
  if (cached && cached.signature === signature) {
    return cached.snapshot;
  }

  const [categoryEntries, featuredEntries, recommendedEntries] = await Promise.all([
    readJsonFile<CasaosCategoryEntry[]>(path.join(repoPath, "category-list.json"), []),
    readJsonFile<CasaosAppReference[]>(path.join(repoPath, "featured-apps.json"), []),
    readJsonFile<CasaosAppReference[]>(path.join(repoPath, "recommend-list.json"), []),
  ]);

  const apps = composePaths
    .map((composePath) => mapCatalogApp(parseComposeToApp(composePath), repoPath))
    .sort((left, right) => left.name.localeCompare(right.name));

  const snapshot: StoreCatalogSnapshot = {
    apps,
    categories: buildCatalogCategories({ apps, categoryEntries }),
    featuredAppIds: normalizeReferences(featuredEntries),
    recommendedAppIds: normalizeReferences(recommendedEntries),
    sourcePath: repoPath,
  };

  catalogCache.set("casaos-catalog", { signature, snapshot }, serverEnv.STORE_CATALOG_TTL_MS);
  return snapshot;
}

export async function bootstrapDefaultCasaosCatalog(options?: { forceRefresh?: boolean }) {
  return withServerTiming(
    {
      layer: "service",
      action: "store.catalog.bootstrap",
      meta: { forceRefresh: Boolean(options?.forceRefresh) },
    },
    async () => {
      const configuredPath = await resolveConfiguredCatalogPath();
      const repoPath = await ensureCasaosCatalogRepo(configuredPath);
      if (options?.forceRefresh) {
        catalogCache.delete("casaos-catalog");
      }
      const snapshot = await buildStoreCatalogSnapshot(repoPath);
      return {
        path: repoPath,
        indexedApps: snapshot.apps.length,
      };
    },
  );
}

export async function getStoreCatalogSnapshot(options?: { bypassCache?: boolean }) {
  return withServerTiming(
    {
      layer: "service",
      action: "store.catalog.snapshot",
      meta: { bypassCache: Boolean(options?.bypassCache) },
    },
    async () => {
      const repoPath = await resolveConfiguredCatalogPath();

      try {
        if (options?.bypassCache) {
          catalogCache.delete("casaos-catalog");
        }

        const ensuredPath = await ensureCasaosCatalogRepo(repoPath);
        return await buildStoreCatalogSnapshot(ensuredPath);
      } catch (error) {
        const cached = catalogCache.get("casaos-catalog");
        if (cached) {
          logServerAction({
            level: "warn",
            layer: "service",
            action: "store.catalog.snapshot",
            status: "error",
            message: "Falling back to cached CasaOS catalog snapshot",
            error,
          });
          return cached.snapshot;
        }

        throw error;
      }
    },
  );
}

export async function listStoreCatalogTemplates(options?: { bypassCache?: boolean }) {
  const snapshot = await getStoreCatalogSnapshot(options);
  return snapshot.apps;
}

export async function findStoreCatalogTemplateByAppId(appId: string) {
  const apps = await listStoreCatalogTemplates();
  return apps.find((app) => app.appId === appId) ?? null;
}
