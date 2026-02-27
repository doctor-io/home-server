import fs from "node:fs";
import path from "node:path";
import type { Config } from "drizzle-kit";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/home_server";

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readDatabaseUrlFromEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;

  const contents = fs.readFileSync(filePath, "utf8");
  const lines = contents.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (key !== "DATABASE_URL") continue;

    const value = trimmed.slice(separatorIndex + 1);
    const parsed = stripWrappingQuotes(value);
    if (parsed.length > 0) return parsed;
  }

  return null;
}

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const cwd = process.cwd();
  const envCandidates = [".env.local", ".env"];
  for (const envFile of envCandidates) {
    const resolved = readDatabaseUrlFromEnvFile(path.join(cwd, envFile));
    if (resolved) return resolved;
  }

  return DEFAULT_DATABASE_URL;
}

export default {
  schema: "./lib/server/db/schema-definitions.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
} satisfies Config;
