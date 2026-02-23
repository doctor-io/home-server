import "server-only";

import type { QueryResult, QueryResultRow } from "pg";
import { pgPool } from "@/lib/server/db/postgres";
import { withServerTiming } from "@/lib/server/logging/logger";

function compactSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

export async function timedPgQuery<T extends QueryResultRow>(
  text: string,
  values?: readonly unknown[],
): Promise<QueryResult<T>> {
  const compact = compactSql(text);

  return withServerTiming(
    {
      level: "debug",
      layer: "db",
      action: "pg.query",
      meta: {
        query: compact,
        paramCount: values?.length ?? 0,
      },
      onSuccessMeta: (result) => ({
        rowCount:
          typeof result === "object" &&
          result !== null &&
          "rowCount" in result &&
          typeof (result as { rowCount?: number | null }).rowCount === "number"
            ? (result as { rowCount: number }).rowCount
            : 0,
      }),
    },
    () => pgPool.query<T>(text, values as unknown[] | undefined),
  );
}
