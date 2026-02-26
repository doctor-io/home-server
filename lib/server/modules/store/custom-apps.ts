import "server-only";

import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { customStoreApps } from "@/lib/server/db/schema";
import { withServerTiming } from "@/lib/server/logging/logger";
import type { StoreCatalogTemplate } from "@/lib/server/modules/store/catalog";

export type CustomStoreSourceType = "docker-compose" | "docker-run";

export type CustomStoreTemplate = StoreCatalogTemplate & {
  isCustom: true;
  sourceType: CustomStoreSourceType;
  composeContent: string;
  sourceText: string;
  webUiUrl: string | null;
};

export type StoreTemplateSource = StoreCatalogTemplate | CustomStoreTemplate;

type UpsertCustomStoreTemplateInput = {
  name: string;
  iconUrl?: string;
  webUiUrl?: string;
  sourceType: CustomStoreSourceType;
  sourceText: string;
  repositoryUrl?: string;
};

function normalize(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeServiceName(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "app";
}

function quoteYaml(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function splitShellCommand(input: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }

      if (char === "\\" && quote === '"' && index + 1 < input.length) {
        current += input[index + 1];
        index += 1;
        continue;
      }

      current += char;
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    if (char === "\\" && index + 1 < input.length) {
      current += input[index + 1];
      index += 1;
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("Invalid docker run command: unmatched quote");
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

function readOptionValue(tokens: string[], index: number) {
  if (index + 1 >= tokens.length) {
    throw new Error(`Invalid docker run command: missing value for ${tokens[index]}`);
  }
  return tokens[index + 1];
}

export function convertDockerRunToCompose(command: string, fallbackServiceName: string) {
  const tokens = splitShellCommand(command.trim());
  let index = 0;

  if (tokens[index] === "docker") {
    index += 1;
  }

  if (tokens[index] === "container" && tokens[index + 1] === "run") {
    index += 2;
  } else if (tokens[index] === "run") {
    index += 1;
  } else {
    throw new Error("Invalid docker run command: must start with `docker run`");
  }

  const env: string[] = [];
  const ports: string[] = [];
  const volumes: string[] = [];
  let containerName = "";

  while (index < tokens.length) {
    const token = tokens[index];

    if (token === "--") {
      index += 1;
      break;
    }

    if (!token.startsWith("-")) {
      break;
    }

    if (token === "--name") {
      containerName = readOptionValue(tokens, index);
      index += 2;
      continue;
    }

    if (token.startsWith("--name=")) {
      containerName = token.slice("--name=".length);
      index += 1;
      continue;
    }

    if (token === "-p" || token === "--publish") {
      ports.push(readOptionValue(tokens, index));
      index += 2;
      continue;
    }

    if (token.startsWith("--publish=")) {
      ports.push(token.slice("--publish=".length));
      index += 1;
      continue;
    }

    if (token.startsWith("-p") && token.length > 2) {
      ports.push(token.slice(2));
      index += 1;
      continue;
    }

    if (token === "-e" || token === "--env") {
      env.push(readOptionValue(tokens, index));
      index += 2;
      continue;
    }

    if (token.startsWith("--env=")) {
      env.push(token.slice("--env=".length));
      index += 1;
      continue;
    }

    if (token.startsWith("-e") && token.length > 2) {
      env.push(token.slice(2));
      index += 1;
      continue;
    }

    if (token === "-v" || token === "--volume") {
      volumes.push(readOptionValue(tokens, index));
      index += 2;
      continue;
    }

    if (token.startsWith("--volume=")) {
      volumes.push(token.slice("--volume=".length));
      index += 1;
      continue;
    }

    if (token.startsWith("-v") && token.length > 2) {
      volumes.push(token.slice(2));
      index += 1;
      continue;
    }

    if (token.includes("=")) {
      index += 1;
      continue;
    }

    if (token.startsWith("--") && index + 1 < tokens.length && !tokens[index + 1].startsWith("-")) {
      index += 2;
      continue;
    }

    index += 1;
  }

  const image = tokens[index];
  if (!image) {
    throw new Error("Invalid docker run command: image is required");
  }
  index += 1;

  const commandArgs = tokens.slice(index);
  const serviceName = sanitizeServiceName(containerName || fallbackServiceName);

  const lines = [
    "services:",
    `  ${serviceName}:`,
    `    image: ${quoteYaml(image)}`,
    "    restart: unless-stopped",
  ];

  if (containerName) {
    lines.push(`    container_name: ${quoteYaml(containerName)}`);
  }

  if (env.length > 0) {
    lines.push("    environment:");
    for (const item of env) {
      lines.push(`      - ${quoteYaml(item)}`);
    }
  }

  if (ports.length > 0) {
    lines.push("    ports:");
    for (const port of ports) {
      lines.push(`      - ${quoteYaml(port)}`);
    }
  }

  if (volumes.length > 0) {
    lines.push("    volumes:");
    for (const volume of volumes) {
      lines.push(`      - ${quoteYaml(volume)}`);
    }
  }

  if (commandArgs.length > 0) {
    lines.push(`    command: ${quoteYaml(commandArgs.join(" "))}`);
  }

  return lines.join("\n");
}

export function extractPortFromWebUi(webUi: string | null | undefined) {
  if (!webUi) return undefined;
  const raw = webUi.trim();
  if (!raw) return undefined;

  if (/^\d+$/.test(raw)) {
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("webUi must contain a valid port between 1 and 65535");
    }
    return port;
  }

  const withProtocol = raw.includes("://") ? raw : `http://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    const port = parsed.port ? Number(parsed.port) : undefined;

    if (port === undefined) {
      return undefined;
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("webUi must contain a valid port between 1 and 65535");
    }

    return port;
  } catch {
    throw new Error("webUi must be a valid URL, host:port, or plain port");
  }
}

function mapRow(row: typeof customStoreApps.$inferSelect): CustomStoreTemplate {
  const sourceType =
    row.sourceType === "docker-run" || row.sourceType === "docker-compose"
      ? row.sourceType
      : "docker-compose";

  return {
    appId: row.appId,
    templateName: row.name,
    name: row.name,
    description:
      sourceType === "docker-run"
        ? "Custom app installed from docker run"
        : "Custom app installed from docker compose",
    platform: sourceType === "docker-run" ? "Docker Run" : "Docker Compose",
    note: "Custom app definition managed from App Store.",
    categories: ["Custom"],
    logoUrl: row.iconUrl,
    repositoryUrl: row.repositoryUrl ?? "custom://local",
    stackFile: `custom/${row.appId}/docker-compose.yml`,
    env: [],
    isCustom: true,
    sourceType,
    composeContent: row.composeContent,
    sourceText: row.sourceText,
    webUiUrl: row.webUiUrl,
  };
}

async function hasCustomStoreAppsTable() {
  const check = await db.execute<{ table_exists: string | null }>(
    sql`SELECT to_regclass('public.custom_store_apps') AS table_exists`,
  );
  return Boolean(check.rows[0]?.table_exists);
}

function normalizeComposeContent(input: {
  sourceType: CustomStoreSourceType;
  sourceText: string;
  fallbackServiceName: string;
}) {
  const sourceText = input.sourceText.trim();
  if (!sourceText) {
    throw new Error("Custom app source cannot be empty");
  }

  if (input.sourceType === "docker-run") {
    return convertDockerRunToCompose(sourceText, input.fallbackServiceName);
  }

  if (!sourceText.includes("services:")) {
    throw new Error("Docker compose source must include a services section");
  }

  return sourceText;
}

export function isCustomStoreTemplate(template: StoreTemplateSource): template is CustomStoreTemplate {
  return "isCustom" in template && template.isCustom === true;
}

export async function listCustomStoreTemplates() {
  return withServerTiming(
    {
      layer: "service",
      action: "store.customApps.list",
    },
    async () => {
      if (!(await hasCustomStoreAppsTable())) return [];

      const rows = await db
        .select()
        .from(customStoreApps)
        .orderBy(desc(customStoreApps.updatedAt));

      return rows.map(mapRow);
    },
  );
}

export async function findCustomStoreTemplateByAppId(appId: string) {
  return withServerTiming(
    {
      layer: "service",
      action: "store.customApps.findById",
      meta: { appId },
    },
    async () => {
      if (!(await hasCustomStoreAppsTable())) return null;

      const rows = await db
        .select()
        .from(customStoreApps)
        .where(eq(customStoreApps.appId, appId))
        .limit(1);

      const row = rows[0];
      return row ? mapRow(row) : null;
    },
  );
}

export async function upsertCustomStoreTemplate(input: UpsertCustomStoreTemplateInput) {
  return withServerTiming(
    {
      layer: "service",
      action: "store.customApps.upsert",
      meta: { sourceType: input.sourceType },
    },
    async () => {
      if (!(await hasCustomStoreAppsTable())) {
        throw new Error("custom_store_apps table is missing. Run `npm run db:init`.");
      }

      const name = input.name.trim();
      if (!name) {
        throw new Error("Custom app name is required");
      }

      const slug = slugify(name);
      const appId = slug ? `custom-${slug}` : `custom-${randomUUID().slice(0, 8)}`;
      const composeContent = normalizeComposeContent({
        sourceType: input.sourceType,
        sourceText: input.sourceText,
        fallbackServiceName: name,
      });

      const rows = await db
        .insert(customStoreApps)
        .values({
          appId,
          name,
          iconUrl: normalize(input.iconUrl),
          webUiUrl: normalize(input.webUiUrl),
          sourceType: input.sourceType,
          sourceText: input.sourceText.trim(),
          composeContent,
          repositoryUrl: normalize(input.repositoryUrl),
          updatedAt: sql`NOW()`,
        })
        .onConflictDoUpdate({
          target: customStoreApps.appId,
          set: {
            name,
            iconUrl: normalize(input.iconUrl),
            webUiUrl: normalize(input.webUiUrl),
            sourceType: input.sourceType,
            sourceText: input.sourceText.trim(),
            composeContent,
            repositoryUrl: normalize(input.repositoryUrl),
            updatedAt: sql`NOW()`,
          },
        })
        .returning();

      return mapRow(rows[0]);
    },
  );
}
