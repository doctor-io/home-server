import type { Config } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";
import { parseEnvFileContent } from "./lib/shared/env-file";

const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/home_server";

function readDatabaseUrlFromEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;

  const env = parseEnvFileContent(fs.readFileSync(filePath, "utf8"));
  return env.DATABASE_URL || null;
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
  schema: "./lib/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
} satisfies Config;
