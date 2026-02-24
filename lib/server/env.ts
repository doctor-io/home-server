import "server-only";

import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://postgres:postgres@127.0.0.1:5432/home_server"),
  PG_MAX_CONNECTIONS: z.coerce.number().int().min(1).max(20).default(10),
  METRICS_CACHE_TTL_MS: z.coerce.number().int().min(250).default(2_000),
  METRICS_PUBLISH_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(500)
    .default(2_000),
  SSE_HEARTBEAT_MS: z.coerce.number().int().min(1_000).default(15_000),
  WEBSOCKET_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  AUTH_SESSION_SECRET: z
    .string()
    .min(16)
    .default("dev-session-secret-change-me"),
  AUTH_SESSION_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(168),
  AUTH_PRIMARY_USERNAME: z.string().min(3).default("admin"),
  AUTH_PRIMARY_PASSWORD: z.string().optional(),
  AUTH_ALLOW_REGISTRATION: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  AUTH_COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  LOG_FILE_PATH: z.string().default("logs/home-server.log"),
  LOG_TO_FILE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  STORE_TEMPLATE_URL: z
    .string()
    .url()
    .default(
      "https://raw.githubusercontent.com/bigbeartechworld/big-bear-portainer/main/templates.json",
    ),
  STORE_CATALOG_TTL_MS: z.coerce.number().int().min(5_000).default(5 * 60_000),
  STORE_STACKS_ROOT: z.string().optional(),
  DOCKER_SOCKET_PATH: z.string().default("/var/run/docker.sock"),
  DBUS_HELPER_SOCKET_PATH: z.string().default("/run/home-server/dbus-helper.sock"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid server environment: ${issues}`);
}

const defaultStacksRoot =
  parsedEnv.data.NODE_ENV === "production" ? "/DATA/Apps" : "DATA/Apps";

export const serverEnv = {
  ...parsedEnv.data,
  STORE_STACKS_ROOT: parsedEnv.data.STORE_STACKS_ROOT ?? defaultStacksRoot,
};
