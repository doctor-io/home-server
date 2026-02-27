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
  METRICS_PUBLISH_INTERVAL_MS: z.coerce.number().int().min(500).default(2_000),
  SSE_HEARTBEAT_MS: z.coerce.number().int().min(1_000).default(15_000),
  WEBSOCKET_ENABLED: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  AUTH_SESSION_SECRET: z
    .string()
    .min(16)
    .default("dev-session-secret-change-me"),
  AUTH_SESSION_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(168),
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
  STORE_CATALOG_TTL_MS: z.coerce
    .number()
    .int()
    .min(5_000)
    .default(6 * 60 * 60_000), // 6 hours
  STORE_STACKS_ROOT: z.string().optional(),
  STORE_APP_DATA_ROOT: z.string().optional(),
  FILES_ROOT: z.string().optional(),
  FILES_ALLOW_HIDDEN: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  TERMINAL_WS_REQUIRE_AUTH: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  TERMINAL_MAX_SESSIONS_PER_USER: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(2),
  TERMINAL_IDLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(10_000)
    .default(900_000),
  TERMINAL_MAX_SESSION_MS: z.coerce
    .number()
    .int()
    .min(60_000)
    .default(3_600_000),
  APP_GRID_REAL_ACTIONS: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  STORE_PRESERVE_INSTALLED_COMPOSE: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  FILES_ENHANCED_OPS: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
  FILES_NETWORK_MOUNT_UID: z.coerce.number().int().min(0).optional(),
  FILES_NETWORK_MOUNT_GID: z.coerce.number().int().min(0).optional(),
  DOCKER_SOCKET_PATH: z.string().default("/var/run/docker.sock"),
  DBUS_HELPER_SOCKET_PATH: z
    .string()
    .default("/run/home-server/dbus-helper.sock"),
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
const defaultAppDataRoot =
  parsedEnv.data.NODE_ENV === "production" ? "/DATA/Apps" : "DATA/Apps";
const defaultFilesRoot =
  parsedEnv.data.NODE_ENV === "production" ? "/DATA" : "DATA";

export const serverEnv = {
  ...parsedEnv.data,
  STORE_STACKS_ROOT: parsedEnv.data.STORE_STACKS_ROOT ?? defaultStacksRoot,
  STORE_APP_DATA_ROOT: parsedEnv.data.STORE_APP_DATA_ROOT ?? defaultAppDataRoot,
  FILES_ROOT: parsedEnv.data.FILES_ROOT ?? defaultFilesRoot,
  FILES_ALLOW_HIDDEN: parsedEnv.data.FILES_ALLOW_HIDDEN ?? false,
};
