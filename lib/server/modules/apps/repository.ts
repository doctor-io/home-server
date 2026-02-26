import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { appStacks } from "@/lib/server/db/schema";
import type { InstalledApp } from "@/lib/shared/contracts/apps";

export async function listInstalledAppsFromDb(): Promise<InstalledApp[]> {
  const tableCheck = await db.execute<{ table_exists: string | null }>(
    sql`SELECT to_regclass('public.app_stacks') AS table_exists`,
  );
  if (!tableCheck.rows[0]?.table_exists) {
    return [];
  }

  const rows = await db
    .select({
      appId: appStacks.appId,
      templateName: appStacks.templateName,
      stackName: appStacks.stackName,
      composePath: appStacks.composePath,
      displayName: appStacks.displayName,
      updatedAt: appStacks.updatedAt,
    })
    .from(appStacks)
    .where(eq(appStacks.status, "installed"))
    .orderBy(asc(sql`COALESCE(${appStacks.displayName}, ${appStacks.templateName})`))
    .limit(200);

  return rows.map((row) => ({
    id: row.appId,
    name: row.displayName || row.templateName || row.appId,
    stackName: row.stackName,
    composePath: row.composePath,
    status: "unknown" as const,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }));
}
