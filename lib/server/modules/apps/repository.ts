import "server-only";

import { timedPgQuery } from "@/lib/server/db/query";
import type { InstalledApp } from "@/lib/shared/contracts/apps";

type AppStackRow = {
  app_id: string;
  template_name: string;
  stack_name: string;
  compose_path: string;
  display_name: string | null;
  updated_at: string | Date;
};

export async function listInstalledAppsFromDb(): Promise<InstalledApp[]> {
  const tableCheck = await timedPgQuery<{ table_exists: string | null }>(
    "SELECT to_regclass('public.app_stacks') AS table_exists",
  );

  if (!tableCheck.rows[0]?.table_exists) {
    return [];
  }

  const result = await timedPgQuery<AppStackRow>(
    `SELECT
      app_id,
      template_name,
      stack_name,
      compose_path,
      display_name,
      updated_at
    FROM app_stacks
    WHERE status = 'installed'
    ORDER BY COALESCE(display_name, template_name) ASC
    LIMIT 200`,
  );

  return result.rows.map((row) => ({
    id: row.app_id,
    name: row.display_name || row.template_name || row.app_id,
    stackName: row.stack_name,
    composePath: row.compose_path,
    status: "unknown" as const,
    updatedAt:
      typeof row.updated_at === "string"
        ? row.updated_at
        : row.updated_at.toISOString(),
  }));
}
