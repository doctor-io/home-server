import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

export function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

export async function hashPassword(plainPassword) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(plainPassword, salt, SCRYPT_KEY_LENGTH);
  return `${salt}:${derived.toString("hex")}`;
}

export async function applyInitSchema(client, initSql) {
  await client.query("BEGIN");
  try {
    await client.query(initSql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function ensurePrincipalUser(
  client,
  { username, password, logger = console },
) {
  const normalizedUsername = normalizeUsername(username);

  const existing = await client.query(
    "SELECT id FROM users WHERE username = $1 LIMIT 1",
    [normalizedUsername],
  );

  if ((existing.rowCount ?? 0) > 0) {
    logger.info(`principal user already exists: ${normalizedUsername}`);
    return { created: false, username: normalizedUsername };
  }

  if (!password) {
    logger.info(
      `principal user missing (${normalizedUsername}) - skipped seeding because AUTH_PRIMARY_PASSWORD is not set`,
    );
    return {
      created: false,
      username: normalizedUsername,
      skipped: true,
    };
  }

  if (password.length < 8) {
    throw new Error("AUTH_PRIMARY_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await hashPassword(password);
  const result = await client.query(
    "INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) ON CONFLICT (username) DO NOTHING",
    [randomUUID(), normalizedUsername, passwordHash],
  );

  const created = (result.rowCount ?? 0) > 0;
  logger.info(
    created
      ? `created principal user: ${normalizedUsername}`
      : `principal user already exists: ${normalizedUsername}`,
  );

  return { created, username: normalizedUsername };
}

export async function bootstrapDatabase({
  databaseUrl,
  initSqlPath,
  primaryUsername,
  primaryPassword,
  logger = console,
}) {
  const client = new Client({
    connectionString: databaseUrl,
  });

  await client.connect();

  try {
    const initSql = await readFile(initSqlPath, "utf8");
    await applyInitSchema(client, initSql);
    logger.info(`applied schema from ${initSqlPath}`);

    await ensurePrincipalUser(client, {
      username: primaryUsername,
      password: primaryPassword,
      logger,
    });
  } finally {
    await client.end();
  }
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : "";

if (invokedFile === currentFile) {
  const scriptDir = dirname(currentFile);
  const rootDir = resolve(scriptDir, "..");

  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/home_server";
  const initSqlPath = resolve(rootDir, "db/init.sql");
  const primaryUsername = process.env.AUTH_PRIMARY_USERNAME ?? "admin";
  const primaryPassword = process.env.AUTH_PRIMARY_PASSWORD;

  bootstrapDatabase({
    databaseUrl,
    initSqlPath,
    primaryUsername,
    primaryPassword,
  })
    .then(() => {
      console.log("database bootstrap completed");
    })
    .catch((error) => {
      console.error("database bootstrap failed");
      console.error(error);
      process.exitCode = 1;
    });
}
