import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { StoreAppEnvDefinition } from "@/lib/shared/contracts/apps";

export type AppDefinition = {
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
  composePath: string;
  env: StoreAppEnvDefinition[];
  screenshots: string[];
  image: string | null;
  volumes: string[];
  port: number | null;
  scheme: string;
  index: string;
  mainServiceName: string;
};

type ComposeService = Record<string, unknown>;
type ComposeDocument = {
  name?: unknown;
  services?: Record<string, ComposeService>;
  [key: string]: unknown;
};

type CasaosSection = {
  title?: unknown;
  description?: unknown;
  icon?: unknown;
  screenshot_link?: unknown;
  category?: unknown;
  tips?: unknown;
  scheme?: unknown;
  port_map?: unknown;
  index?: unknown;
  main?: unknown;
};

type CasaosEnvMetadata = {
  container?: unknown;
  label?: unknown;
  name?: unknown;
  description?: unknown;
};

const INFRA_SERVICE_TOKEN_PATTERN =
  /(?:^|[-_.])(db|database|postgres|postgresql|mariadb|mysql|redis|cache|broker|queue|rabbitmq|kafka|zookeeper|mongo|mongodb|elasticsearch|minio)(?:$|[-_.])/i;
const APP_ALIAS_PATTERN = /^(app|main|server|web|frontend|backend)$/i;
const DEFAULT_DESCRIPTION = "No description available.";
const DEFAULT_NOTE = "No installation notes provided.";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLocaleKey(value: string) {
  return value.trim().toLowerCase().replace(/-/g, "_");
}

function resolveLocalizedValue(input: unknown): string | null {
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }

  const entries = Object.entries(input as Record<string, unknown>).filter(
    ([, value]) => typeof value === "string" && value.trim().length > 0,
  );
  if (entries.length === 0) {
    return null;
  }

  const values = new Map(entries.map(([key, value]) => [normalizeLocaleKey(key), String(value).trim()]));
  for (const preferred of ["en_us", "en", "en_gb", "en-ca", "en_au"]) {
    const exact = values.get(normalizeLocaleKey(preferred));
    if (exact) return exact;
  }

  return entries[0]?.[1] ? String(entries[0][1]).trim() : null;
}

function resolveScreenshots(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function resolveCategories(input: unknown) {
  const raw = Array.isArray(input) ? input : [input];
  const categories = raw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return categories.length > 0 ? Array.from(new Set(categories)) : ["Utilities"];
}

function parseEnvironment(service: ComposeService) {
  const environment = service.environment;
  const result: Record<string, string> = {};

  if (Array.isArray(environment)) {
    for (const entry of environment) {
      if (typeof entry !== "string") continue;
      const [key, ...valueParts] = entry.split("=");
      if (!key) continue;
      result[key] = valueParts.join("=");
    }
    return result;
  }

  if (!environment || typeof environment !== "object") {
    return result;
  }

  for (const [key, value] of Object.entries(environment as Record<string, unknown>)) {
    if (typeof value === "string") {
      result[key] = value;
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      result[key] = String(value);
      continue;
    }

    result[key] = "";
  }

  return result;
}

function parseVolumes(service: ComposeService) {
  const volumes = service.volumes;
  if (!Array.isArray(volumes)) return [];

  return volumes
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (!entry || typeof entry !== "object") {
        return "";
      }

      const candidate = entry as {
        source?: unknown;
        target?: unknown;
        type?: unknown;
      };
      const source = typeof candidate.source === "string" ? candidate.source.trim() : "";
      const target = typeof candidate.target === "string" ? candidate.target.trim() : "";
      if (!target) return "";
      return source ? `${source}:${target}` : target;
    })
    .filter((entry) => entry.length > 0);
}

function parsePortNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isInteger(input) && input > 0 && input <= 65535) {
    return input;
  }

  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return parsed >= 1 && parsed <= 65535 ? parsed : null;
  }

  const defaultMatch = trimmed.match(/\$\{[^}:]+:-?(\d+)\}/);
  if (defaultMatch?.[1]) {
    const parsed = Number.parseInt(defaultMatch[1], 10);
    return parsed >= 1 && parsed <= 65535 ? parsed : null;
  }

  return null;
}

function parseFirstPublishedPort(service: ComposeService): number | null {
  const ports = service.ports;
  if (!Array.isArray(ports)) return null;

  for (const entry of ports) {
    if (typeof entry === "string") {
      const [mappingPart] = entry.split("/");
      const segments = mappingPart.split(":").filter(Boolean);
      const published = segments.length >= 2 ? segments[segments.length - 2] : segments[0];
      const parsed = parsePortNumber(published);
      if (parsed !== null) return parsed;
      continue;
    }

    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as { published?: unknown; target?: unknown };
    const parsed = parsePortNumber(candidate.published ?? candidate.target);
    if (parsed !== null) return parsed;
  }

  return null;
}

function hasPublishedPorts(service: ComposeService) {
  return parseFirstPublishedPort(service) !== null;
}

function scorePrimaryServiceCandidate(input: {
  name: string;
  service: ComposeService;
  appId?: string;
}) {
  const name = input.name.toLowerCase();
  const appId = input.appId?.toLowerCase().trim();
  const image = typeof input.service.image === "string" ? input.service.image.toLowerCase() : "";

  let score = 0;
  if (hasPublishedPorts(input.service)) score += 40;
  if (name === "app") score += 60;
  else if (APP_ALIAS_PATTERN.test(name)) score += 30;
  if (name.includes("server")) score += 20;

  if (appId) {
    if (name === appId) score += 100;
    else if (name.startsWith(`${appId}-`) || name.endsWith(`-${appId}`)) score += 45;
    else if (name.includes(appId)) score += 25;
    if (image.includes(appId)) score += 20;
  }

  if (INFRA_SERVICE_TOKEN_PATTERN.test(name)) score -= 80;
  return score;
}

function resolveMainServiceName(services: Record<string, ComposeService>, casaos: CasaosSection, appId: string) {
  const configured = typeof casaos.main === "string" ? casaos.main.trim() : "";
  if (configured && services[configured]) {
    return configured;
  }

  const entries = Object.entries(services);
  if (entries.length === 0) {
    throw new Error("Compose file does not define any services");
  }

  return entries
    .map(([name, service], index) => ({
      name,
      index,
      score: scorePrimaryServiceCandidate({ name, service, appId }),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.name ?? entries[0][0];
}

function resolveEnvDefinitions(service: ComposeService) {
  const environment = parseEnvironment(service);
  const metadata = ((service["x-casaos"] as { envs?: unknown } | undefined)?.envs ?? []) as unknown;
  const metadataByKey = new Map<string, CasaosEnvMetadata>();

  if (Array.isArray(metadata)) {
    for (const entry of metadata) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as CasaosEnvMetadata;
      const key = typeof item.container === "string"
        ? item.container.trim()
        : typeof item.name === "string"
          ? item.name.trim()
          : "";
      if (!key) continue;
      metadataByKey.set(key, item);
    }
  }

  return Object.keys(environment)
    .sort((left, right) => left.localeCompare(right))
    .map((name) => {
      const item = metadataByKey.get(name);
      return {
        name,
        label:
          typeof item?.label === "string" && item.label.trim().length > 0
            ? item.label.trim()
            : undefined,
        description: resolveLocalizedValue(item?.description) ?? undefined,
        default: environment[name],
      } satisfies StoreAppEnvDefinition;
    });
}

function parseComposeContentToAppDefinition(composePath: string, content: string): AppDefinition {
  const parsed = yaml.load(content) as ComposeDocument | null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid compose file: ${composePath}`);
  }

  const services = parsed.services;
  if (!services || typeof services !== "object" || Array.isArray(services) || Object.keys(services).length === 0) {
    throw new Error(`Compose file does not define any services: ${composePath}`);
  }

  const casaos = ((parsed["x-casaos"] as CasaosSection | undefined) ?? {}) as CasaosSection;
  const composeName = typeof parsed.name === "string" && parsed.name.trim().length > 0
    ? parsed.name.trim()
    : path.basename(path.dirname(composePath));
  const appId = slugify(composeName) || slugify(path.basename(path.dirname(composePath))) || "app";
  const mainServiceName = resolveMainServiceName(services, casaos, appId);
  const mainService = services[mainServiceName];

  const description = resolveLocalizedValue(casaos.description) ?? DEFAULT_DESCRIPTION;
  const note =
    resolveLocalizedValue(casaos.tips) ??
    resolveLocalizedValue((casaos.tips as { before_install?: unknown } | undefined)?.before_install) ??
    description ??
    DEFAULT_NOTE;
  const port = parsePortNumber(casaos.port_map) ?? parsePortNumber((mainService["x-casaos"] as CasaosSection | undefined)?.port_map) ?? parseFirstPublishedPort(mainService);
  const index = typeof casaos.index === "string" && casaos.index.trim().length > 0 ? casaos.index.trim() : "/";
  const scheme = typeof casaos.scheme === "string" && casaos.scheme.trim().length > 0 ? casaos.scheme.trim() : "http";

  return {
    appId,
    templateName: composeName,
    name: resolveLocalizedValue(casaos.title) ?? composeName,
    description,
    platform: "Docker Compose",
    note,
    categories: resolveCategories(casaos.category),
    logoUrl: typeof casaos.icon === "string" && casaos.icon.trim().length > 0 ? casaos.icon.trim() : null,
    repositoryUrl: "",
    stackFile: path.relative(path.dirname(composePath), composePath),
    composePath: path.resolve(composePath),
    env: resolveEnvDefinitions(mainService),
    screenshots: resolveScreenshots(casaos.screenshot_link),
    image: typeof mainService.image === "string" && mainService.image.trim().length > 0 ? mainService.image.trim() : null,
    volumes: parseVolumes(mainService),
    port,
    scheme,
    index,
    mainServiceName,
  };
}

export function parseComposeToApp(composePath: string): AppDefinition {
  const content = readFileSync(composePath, "utf8");
  return parseComposeContentToAppDefinition(composePath, content);
}

export function parseComposeContentToApp(composePath: string, content: string): AppDefinition {
  return parseComposeContentToAppDefinition(composePath, content);
}
