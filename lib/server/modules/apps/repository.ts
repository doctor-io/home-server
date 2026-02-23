import "server-only";

import { timedPgQuery } from "@/lib/server/db/query";
import type { InstalledApp } from "@/lib/shared/contracts/apps";

type AppRow = {
  id: string;
  name: string;
  status: string;
  updated_at: string | Date;
};

export async function listInstalledAppsFromDb(): Promise<InstalledApp[]> {
  const tableCheck = await timedPgQuery<{ table_exists: string | null }>(
    "SELECT to_regclass('public.apps') AS table_exists",
  );

  if (!tableCheck.rows[0]?.table_exists) {
    return [];
  }

  const result = await timedPgQuery<AppRow>(
    "SELECT id, name, status, updated_at FROM apps ORDER BY name ASC LIMIT 200",
  );

  return result.rows.map((row) => {
    const status =
      row.status === "running" || row.status === "stopped"
        ? row.status
        : "unknown";

    return {
      id: row.id,
      name: row.name,
      status,
      updatedAt:
        typeof row.updated_at === "string"
          ? row.updated_at
          : row.updated_at.toISOString(),
    };
  });
}
