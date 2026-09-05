#!/usr/bin/env bash
# Homeio emergency password reset
#
# Resets the password for an existing Homeio user directly in the database.
# Use this when you are locked out after a restore or have forgotten your
# password and cannot log in through the UI.
#
# Usage:
#   sudo bash scripts/reset-password.sh
#
# Requirements:
#   - Node.js 22.x must be in PATH
#   - The DATABASE_URL environment variable must be set, OR a .env.local file
#     must exist in the same directory as this script (the project root).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
ENV_FILE="${PROJECT_ROOT}/.env.local"

# ── Load DATABASE_URL from .env.local if not already set ──────────────────────
if [ -z "${DATABASE_URL:-}" ] && [ -f "${ENV_FILE}" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | head -1 | cut -d= -f2-)"
  export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set and could not be loaded from ${ENV_FILE}" >&2
  exit 1
fi

# ── Prompt for username and new password ──────────────────────────────────────
echo ""
echo "Homeio — Emergency Password Reset"
echo "──────────────────────────────────"
echo ""

read -rp "Username to reset: " TARGET_USERNAME
if [ -z "${TARGET_USERNAME}" ]; then
  echo "Error: username cannot be empty." >&2
  exit 1
fi

read -rsp "New password: " NEW_PASSWORD
echo ""
if [ -z "${NEW_PASSWORD}" ]; then
  echo "Error: password cannot be empty." >&2
  exit 1
fi

read -rsp "Confirm new password: " CONFIRM_PASSWORD
echo ""
if [ "${NEW_PASSWORD}" != "${CONFIRM_PASSWORD}" ]; then
  echo "Error: passwords do not match." >&2
  exit 1
fi

# ── Hash password and update DB using Node.js inline script ───────────────────
# Runs from the project root so the `pg` dependency resolves, and passes the
# credentials through the environment rather than interpolating them into the
# script source — the heredoc is quoted so bash performs no expansion at all.
# Uses the same scrypt parameters as lib/server/modules/auth/password.ts
cd "${PROJECT_ROOT}"

HOMEIO_RESET_USERNAME="${TARGET_USERNAME}" \
HOMEIO_RESET_PASSWORD="${NEW_PASSWORD}" \
node --input-type=module <<'NODE_SCRIPT'
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scrypt = promisify(scryptCallback);
const SCRYPT_KEY_LENGTH = 64;

const username = process.env.HOMEIO_RESET_USERNAME;
const plainPassword = process.env.HOMEIO_RESET_PASSWORD;
const databaseUrl = process.env.DATABASE_URL;

const salt = randomBytes(16).toString("hex");
const derived = await scrypt(plainPassword, salt, SCRYPT_KEY_LENGTH);
const hash = `${salt}:${derived.toString("hex")}`;

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  const result = await client.query(
    "UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id",
    [hash, username],
  );

  if (result.rowCount === 0) {
    console.error(`Error: user "${username}" not found in the database.`);
    process.exitCode = 1;
  } else {
    console.log(`Password for "${username}" has been reset successfully.`);
    console.log("You can now log in with the new password.");
  }
} finally {
  await client.end();
}
NODE_SCRIPT
