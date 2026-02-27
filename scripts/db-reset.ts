import { spawn } from "node:child_process";
import { drizzle } from "drizzle-orm/node-postgres";
import { reset } from "drizzle-seed";
import { Pool } from "pg";

// path to a file with schema you want to reset
import * as schema from "../lib/server/db/schema-definitions";

function isMissingRelationError(error: unknown) {
  const err = error as {
    code?: string;
    message?: string;
    cause?: {
      code?: string;
      message?: string;
    };
  };

  if (err.code === "42P01" || err.cause?.code === "42P01") {
    return true;
  }

  const message = `${err.message ?? ""}\n${err.cause?.message ?? ""}`.toLowerCase();
  return message.includes("does not exist");
}

async function runDbInit(databaseUrl: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["run", "db:init", "--silent"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`db:init failed with exit code ${code ?? "unknown"}`));
    });
  });
}

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@127.0.0.1:5432/home_server";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    let retriedAfterInit = false;

    while (true) {
      try {
        await reset(db, schema);
        break;
      } catch (error) {
        if (!retriedAfterInit && isMissingRelationError(error)) {
          retriedAfterInit = true;
          console.warn(
            "Detected missing database tables. Running db:init once, then retrying db:reset...",
          );
          await runDbInit(databaseUrl);
          continue;
        }

        throw error;
      }
    }

    console.log("Database reset complete.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Database reset failed.");
  console.error(error);
  process.exitCode = 1;
});
