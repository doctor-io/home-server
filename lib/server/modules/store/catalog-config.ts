import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StoreCatalogSource } from "@/lib/shared/contracts/apps";
import { resolveDataRootDirectory } from "@/lib/server/storage/data-root";

const STORE_CONFIG_DIRNAME = "AppStore";
const STORE_CONFIG_FILENAME = "catalog-source.json";

export const OFFICIAL_STORE_SOURCE_ID = "official-casaos";

export type StoreCatalogConfig = {
  defaultCatalogPath: string;
  repoUrl: string;
  updatedAt: string;
};

type StoreCatalogRegistry = {
  version: 2;
  sources: StoreCatalogSource[];
};

function resolveStoreConfigDirectory() {
  return path.join(resolveDataRootDirectory(), STORE_CONFIG_DIRNAME);
}

export function resolveStoreCatalogConfigPath() {
  return path.join(resolveStoreConfigDirectory(), STORE_CONFIG_FILENAME);
}

function isStoreCatalogSource(input: unknown): input is StoreCatalogSource {
  const value = input as Partial<StoreCatalogSource>;
  return (
    value !== null &&
    typeof value === "object" &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.url === "string" &&
    (value.kind === "official" || value.kind === "remote") &&
    typeof value.enabled === "boolean" &&
    (value.status === "ready" || value.status === "syncing" || value.status === "error") &&
    typeof value.sourcePath === "string" &&
    Array.isArray(value.suppressedAppIds) &&
    typeof value.addedAt === "string" &&
    typeof value.updatedAt === "string" &&
    (value.lastSyncedAt === null || typeof value.lastSyncedAt === "string") &&
    (value.lastError === null || typeof value.lastError === "string")
  );
}

function normalizeSource(source: StoreCatalogSource): StoreCatalogSource {
  return {
    ...source,
    sourcePath: path.resolve(source.sourcePath),
    suppressedAppIds: Array.from(new Set(source.suppressedAppIds)),
  };
}

function toOfficialConfigSource(input?: StoreCatalogConfig | null): StoreCatalogSource {
  const defaultCatalogPath = path.resolve(
    input?.defaultCatalogPath ?? path.join(resolveStoreConfigDirectory(), "CasaOS-AppStore"),
  );
  const updatedAt = input?.updatedAt ?? new Date(0).toISOString();

  return {
    id: OFFICIAL_STORE_SOURCE_ID,
    name: "Official CasaOS",
    url: input?.repoUrl ?? "https://github.com/IceWhaleTech/CasaOS-AppStore",
    kind: "official",
    enabled: true,
    status: "ready",
    sourcePath: defaultCatalogPath,
    suppressedAppIds: [],
    addedAt: updatedAt,
    updatedAt,
    lastSyncedAt: updatedAt,
    lastError: null,
  };
}

function parseLegacyConfig(raw: string): StoreCatalogConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoreCatalogConfig>;

    if (
      typeof parsed.defaultCatalogPath !== "string" ||
      parsed.defaultCatalogPath.trim().length === 0 ||
      typeof parsed.repoUrl !== "string" ||
      parsed.repoUrl.trim().length === 0
    ) {
      return null;
    }

    return {
      defaultCatalogPath: parsed.defaultCatalogPath,
      repoUrl: parsed.repoUrl,
      updatedAt:
        typeof parsed.updatedAt === "string" && parsed.updatedAt.trim().length > 0
          ? parsed.updatedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function parseRegistry(raw: string): StoreCatalogRegistry | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoreCatalogRegistry>;
    if (parsed.version !== 2 || !Array.isArray(parsed.sources)) {
      return null;
    }

    const sources = parsed.sources.filter(isStoreCatalogSource).map(normalizeSource);
    return {
      version: 2,
      sources,
    };
  } catch {
    return null;
  }
}

function ensureOfficialSource(sources: StoreCatalogSource[]) {
  const existingOfficial = sources.find((source) => source.id === OFFICIAL_STORE_SOURCE_ID);
  const remainder = sources.filter((source) => source.id !== OFFICIAL_STORE_SOURCE_ID);

  return [
    normalizeSource(
      existingOfficial ??
        toOfficialConfigSource({
          defaultCatalogPath: path.join(resolveStoreConfigDirectory(), "CasaOS-AppStore"),
          repoUrl: "https://github.com/IceWhaleTech/CasaOS-AppStore",
          updatedAt: new Date(0).toISOString(),
        }),
    ),
    ...remainder.map(normalizeSource),
  ];
}

export async function readStoreCatalogSources(): Promise<StoreCatalogSource[]> {
  try {
    const raw = await readFile(resolveStoreCatalogConfigPath(), "utf8");
    const registry = parseRegistry(raw);
    if (registry) {
      return ensureOfficialSource(registry.sources);
    }

    const legacy = parseLegacyConfig(raw);
    return ensureOfficialSource([toOfficialConfigSource(legacy)]);
  } catch {
    return ensureOfficialSource([]);
  }
}

export async function writeStoreCatalogSources(sources: StoreCatalogSource[]) {
  const registry: StoreCatalogRegistry = {
    version: 2,
    sources: ensureOfficialSource(sources),
  };

  await mkdir(resolveStoreConfigDirectory(), { recursive: true });
  await writeFile(resolveStoreCatalogConfigPath(), JSON.stringify(registry, null, 2), "utf8");

  return registry.sources;
}

export async function readStoreCatalogConfig(): Promise<StoreCatalogConfig | null> {
  const sources = await readStoreCatalogSources();
  const official = sources.find((source) => source.id === OFFICIAL_STORE_SOURCE_ID);
  if (!official) return null;

  return {
    defaultCatalogPath: official.sourcePath,
    repoUrl: official.url,
    updatedAt: official.updatedAt,
  };
}

export async function writeStoreCatalogConfig(input: {
  defaultCatalogPath: string;
  repoUrl: string;
}) {
  const sources = await readStoreCatalogSources();
  const official = toOfficialConfigSource({
    defaultCatalogPath: path.resolve(input.defaultCatalogPath),
    repoUrl: input.repoUrl,
    updatedAt: new Date().toISOString(),
  });

  const nextSources = [
    official,
    ...sources.filter((source) => source.id !== OFFICIAL_STORE_SOURCE_ID),
  ];
  await writeStoreCatalogSources(nextSources);

  return {
    defaultCatalogPath: official.sourcePath,
    repoUrl: official.url,
    updatedAt: official.updatedAt,
  };
}

export function resolveStoreCatalogsRoot() {
  return resolveStoreConfigDirectory();
}
