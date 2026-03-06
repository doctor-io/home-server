import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveDataRootDirectory } from "@/lib/server/storage/data-root";

const STORE_CONFIG_DIRNAME = "AppStore";
const STORE_CONFIG_FILENAME = "catalog-source.json";

export type StoreCatalogConfig = {
  defaultCatalogPath: string;
  repoUrl: string;
  updatedAt: string;
};

function resolveStoreConfigDirectory() {
  return path.join(resolveDataRootDirectory(), STORE_CONFIG_DIRNAME);
}

export function resolveStoreCatalogConfigPath() {
  return path.join(resolveStoreConfigDirectory(), STORE_CONFIG_FILENAME);
}

export async function readStoreCatalogConfig(): Promise<StoreCatalogConfig | null> {
  try {
    const raw = await readFile(resolveStoreCatalogConfigPath(), "utf8");
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

export async function writeStoreCatalogConfig(input: {
  defaultCatalogPath: string;
  repoUrl: string;
}) {
  const config: StoreCatalogConfig = {
    defaultCatalogPath: path.resolve(input.defaultCatalogPath),
    repoUrl: input.repoUrl,
    updatedAt: new Date().toISOString(),
  };

  await mkdir(resolveStoreConfigDirectory(), { recursive: true });
  await writeFile(resolveStoreCatalogConfigPath(), JSON.stringify(config, null, 2), "utf8");

  return config;
}

export function resolveStoreCatalogsRoot() {
  return resolveStoreConfigDirectory();
}
