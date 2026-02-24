import "server-only";

import { LruCache } from "@/lib/server/cache/lru";
import { serverEnv } from "@/lib/server/env";
import { logServerAction, withServerTiming } from "@/lib/server/logging/logger";
import type { StoreAppEnvDefinition } from "@/lib/shared/contracts/apps";

type UpstreamTemplateRepository = {
  url?: unknown;
  stackfile?: unknown;
};

type UpstreamTemplateEnv = {
  name?: unknown;
  label?: unknown;
  description?: unknown;
  default?: unknown;
};

type UpstreamTemplate = {
  id?: unknown;
  title?: unknown;
  name?: unknown;
  description?: unknown;
  note?: unknown;
  platform?: unknown;
  categories?: unknown;
  logo?: unknown;
  repository?: UpstreamTemplateRepository;
  env?: unknown;
};

type UpstreamTemplatePayload = {
  templates?: unknown;
};

type CacheMetadata = {
  etag: string | null;
  lastModified: string | null;
};

export type StoreCatalogTemplate = {
  appId: string;
  templateName: string;
  name: string;
  description: string;
  platform: string;
  note: string;
  categories: string[];
  logoUrl: string | null;
  repositoryUrl: string;
  stackFile: string;
  env: StoreAppEnvDefinition[];
};

const catalogCache = new LruCache<StoreCatalogTemplate[]>(1, serverEnv.STORE_CATALOG_TTL_MS);
let metadata: CacheMetadata = {
  etag: null,
  lastModified: null,
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toPlatform(value: unknown) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);

    if (values.length > 0) {
      return Array.from(new Set(values)).join(", ");
    }
  }

  return "Docker";
}

function normalizeCategoryKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function toCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return ["Uncategorized"];
  }

  const categories = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);

  const filtered = Array.from(
    new Set(
      categories.filter((category) => normalizeCategoryKey(category) !== "bigbearcasaos"),
    ),
  );

  if (filtered.length === 0) {
    return ["Uncategorized"];
  }

  return filtered;
}

function toEnvDefinitions(value: unknown): StoreAppEnvDefinition[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => item as UpstreamTemplateEnv)
    .filter((item) => typeof item?.name === "string" && item.name.trim().length > 0)
    .map((item) => ({
      name: String(item.name).trim(),
      label: typeof item.label === "string" ? item.label : undefined,
      description: typeof item.description === "string" ? item.description : undefined,
      default: typeof item.default === "string" ? item.default : undefined,
    }));
}

function normalizeTemplate(item: UpstreamTemplate, index: number): StoreCatalogTemplate | null {
  const repository = item.repository ?? {};
  const repositoryUrl = toStringValue(repository.url);
  const stackFile = toStringValue(repository.stackfile);
  if (!repositoryUrl || !stackFile) {
    return null;
  }

  const templateName = toStringValue(item.name, toStringValue(item.title, `app-${index + 1}`));
  const displayName = toStringValue(item.title, templateName);
  const description = toStringValue(item.description, "No description");
  const note = toStringValue(item.note, description);
  const appIdBase = slugify(templateName || displayName || `app-${index + 1}`);
  const appId = appIdBase.length > 0 ? appIdBase : `app-${index + 1}`;

  return {
    appId,
    templateName,
    name: displayName,
    description,
    platform: toPlatform(item.platform),
    note,
    categories: toCategories(item.categories),
    logoUrl: toStringValue(item.logo) || null,
    repositoryUrl,
    stackFile,
    env: toEnvDefinitions(item.env),
  };
}

function normalizePayload(payload: UpstreamTemplatePayload): StoreCatalogTemplate[] {
  if (!Array.isArray(payload.templates)) {
    return [];
  }

  const seen = new Set<string>();
  const result: StoreCatalogTemplate[] = [];

  payload.templates.forEach((raw, index) => {
    const normalized = normalizeTemplate((raw ?? {}) as UpstreamTemplate, index);
    if (!normalized) return;

    let dedupedId = normalized.appId;
    let suffix = 2;
    while (seen.has(dedupedId)) {
      dedupedId = `${normalized.appId}-${suffix++}`;
    }
    seen.add(dedupedId);

    result.push({
      ...normalized,
      appId: dedupedId,
    });
  });

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listStoreCatalogTemplates(options?: { bypassCache?: boolean }) {
  return withServerTiming(
    {
      layer: "service",
      action: "store.catalog.fetch",
      meta: {
        bypassCache: Boolean(options?.bypassCache),
        source: serverEnv.STORE_TEMPLATE_URL,
      },
    },
    async () => {
      const cached = catalogCache.get("bigbear-catalog");

      if (!options?.bypassCache && cached) {
        return cached;
      }

      const headers = new Headers();
      if (metadata.etag) headers.set("If-None-Match", metadata.etag);
      if (metadata.lastModified) headers.set("If-Modified-Since", metadata.lastModified);

      try {
        let response = await fetch(serverEnv.STORE_TEMPLATE_URL, {
          method: "GET",
          headers,
          cache: "no-store",
        });

        if (response.status === 304) {
          if (cached) {
            catalogCache.set("bigbear-catalog", cached, serverEnv.STORE_CATALOG_TTL_MS);
            return cached;
          }

          // Metadata can outlive in-memory cache; retry once without validators.
          metadata = { etag: null, lastModified: null };
          response = await fetch(serverEnv.STORE_TEMPLATE_URL, {
            method: "GET",
            cache: "no-store",
          });
        }

        if (!response.ok) {
          throw new Error(
            `Failed to fetch template catalog (${response.status}) from ${serverEnv.STORE_TEMPLATE_URL}`,
          );
        }

        const json = (await response.json()) as UpstreamTemplatePayload;
        const normalized = normalizePayload(json);

        metadata = {
          etag: response.headers.get("etag"),
          lastModified: response.headers.get("last-modified"),
        };

        catalogCache.set("bigbear-catalog", normalized, serverEnv.STORE_CATALOG_TTL_MS);
        return normalized;
      } catch (error) {
        if (cached) {
          logServerAction({
            level: "warn",
            layer: "service",
            action: "store.catalog.fetch",
            status: "error",
            message: "Template catalog fetch failed; serving cached catalog",
            error,
            meta: {
              source: serverEnv.STORE_TEMPLATE_URL,
              cachedEntries: cached.length,
            },
          });
          return cached;
        }

        throw error;
      }
    },
  );
}

export async function findStoreCatalogTemplateByAppId(
  appId: string,
  options?: { bypassCache?: boolean },
) {
  const templates = await listStoreCatalogTemplates(options);
  return templates.find((template) => template.appId === appId) ?? null;
}
