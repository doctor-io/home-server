import "server-only";

import { timedPgQuery } from "@/lib/server/db/query";
import type {
  InstalledStackConfig,
  InstalledStackStatus,
  StoreOperation,
  StoreOperationAction,
  StoreOperationStatus,
} from "@/lib/shared/contracts/apps";

type TableExistsRow = {
  table_exists: string | null;
};

type AppStackRow = {
  app_id: string;
  template_name: string;
  stack_name: string;
  compose_path: string;
  status: string;
  web_ui_port: number | null;
  env_json: unknown;
  display_name: string | null;
  icon_url: string | null;
  installed_at: string | Date | null;
  updated_at: string | Date;
};

type OperationRow = {
  id: string;
  app_id: string;
  action: string;
  status: string;
  progress_percent: number;
  current_step: string;
  error_message: string | null;
  started_at: string | Date | null;
  finished_at: string | Date | null;
  updated_at: string | Date;
};

function toIso(value: string | Date | null) {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function toInstalledStackStatus(status: string): InstalledStackStatus {
  if (
    status === "installed" ||
    status === "not_installed" ||
    status === "installing" ||
    status === "error" ||
    status === "updating" ||
    status === "uninstalling"
  ) {
    return status;
  }

  return "error";
}

function toOperationStatus(status: string): StoreOperationStatus {
  if (status === "queued" || status === "running" || status === "success" || status === "error") {
    return status;
  }

  return "error";
}

function toOperationAction(action: string): StoreOperationAction {
  if (action === "install" || action === "redeploy" || action === "uninstall") {
    return action;
  }

  return "redeploy";
}

function parseEnvJson(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const out: Record<string, string> = {};

  for (const [key, raw] of Object.entries(record)) {
    if (typeof raw === "string") {
      out[key] = raw;
      continue;
    }

    if (typeof raw === "number" || typeof raw === "boolean") {
      out[key] = String(raw);
    }
  }

  return out;
}

async function hasTable(tableName: "app_stacks" | "app_operations") {
  const check = await timedPgQuery<TableExistsRow>(
    `SELECT to_regclass('public.${tableName}') AS table_exists`,
  );

  return Boolean(check.rows[0]?.table_exists);
}

function mapStackRow(row: AppStackRow): InstalledStackConfig {
  return {
    appId: row.app_id,
    templateName: row.template_name,
    stackName: row.stack_name,
    composePath: row.compose_path,
    status: toInstalledStackStatus(row.status),
    webUiPort: row.web_ui_port,
    env: parseEnvJson(row.env_json),
    displayName: row.display_name ?? null,
    iconUrl: row.icon_url ?? null,
    installedAt: toIso(row.installed_at),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

function mapOperationRow(row: OperationRow): StoreOperation {
  return {
    id: row.id,
    appId: row.app_id,
    action: toOperationAction(row.action),
    status: toOperationStatus(row.status),
    progressPercent: row.progress_percent,
    currentStep: row.current_step,
    errorMessage: row.error_message,
    startedAt: toIso(row.started_at),
    finishedAt: toIso(row.finished_at),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

export async function listInstalledStacksFromDb(): Promise<InstalledStackConfig[]> {
  if (!(await hasTable("app_stacks"))) {
    return [];
  }

  const result = await timedPgQuery<AppStackRow>(
    `SELECT
      app_id,
      template_name,
      stack_name,
      compose_path,
      status,
      web_ui_port,
      env_json,
      display_name,
      icon_url,
      installed_at,
      updated_at
    FROM app_stacks
    ORDER BY app_id ASC`,
  );

  return result.rows.map(mapStackRow);
}

export async function findInstalledStackByAppId(appId: string): Promise<InstalledStackConfig | null> {
  if (!(await hasTable("app_stacks"))) {
    return null;
  }

  const result = await timedPgQuery<AppStackRow>(
    `SELECT
      app_id,
      template_name,
      stack_name,
      compose_path,
      status,
      web_ui_port,
      env_json,
      display_name,
      icon_url,
      installed_at,
      updated_at
    FROM app_stacks
    WHERE app_id = $1
    LIMIT 1`,
    [appId],
  );

  const row = result.rows[0];
  return row ? mapStackRow(row) : null;
}

export async function findStackByWebUiPort(
  port: number,
  options?: { excludeAppId?: string },
): Promise<InstalledStackConfig | null> {
  if (!(await hasTable("app_stacks"))) {
    return null;
  }

  const result = await timedPgQuery<AppStackRow>(
    `SELECT
      app_id,
      template_name,
      stack_name,
      compose_path,
      status,
      web_ui_port,
      env_json,
      display_name,
      icon_url,
      installed_at,
      updated_at
    FROM app_stacks
    WHERE web_ui_port = $1
      AND ($2::text IS NULL OR app_id <> $2::text)
      AND status <> 'not_installed'
    LIMIT 1`,
    [port, options?.excludeAppId ?? null],
  );

  const row = result.rows[0];
  return row ? mapStackRow(row) : null;
}

export async function upsertInstalledStack(input: {
  appId: string;
  templateName: string;
  stackName: string;
  composePath: string;
  status: InstalledStackStatus;
  webUiPort: number | null;
  env: Record<string, string>;
  markInstalledAt?: boolean;
}) {
  if (!(await hasTable("app_stacks"))) return;

  await timedPgQuery(
    `INSERT INTO app_stacks (
      app_id,
      template_name,
      stack_name,
      compose_path,
      status,
      web_ui_port,
      env_json,
      installed_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7::jsonb,
      CASE WHEN $8::boolean THEN NOW() ELSE NULL END,
      NOW()
    )
    ON CONFLICT (app_id)
    DO UPDATE SET
      template_name = EXCLUDED.template_name,
      stack_name = EXCLUDED.stack_name,
      compose_path = EXCLUDED.compose_path,
      status = EXCLUDED.status,
      web_ui_port = EXCLUDED.web_ui_port,
      env_json = EXCLUDED.env_json,
      installed_at = CASE
        WHEN app_stacks.installed_at IS NULL AND $8::boolean THEN NOW()
        ELSE app_stacks.installed_at
      END,
      updated_at = NOW()`,
    [
      input.appId,
      input.templateName,
      input.stackName,
      input.composePath,
      input.status,
      input.webUiPort,
      JSON.stringify(input.env),
      Boolean(input.markInstalledAt),
    ],
  );
}

export async function deleteInstalledStackByAppId(appId: string) {
  if (!(await hasTable("app_stacks"))) return;

  await timedPgQuery(
    `DELETE FROM app_stacks
    WHERE app_id = $1`,
    [appId],
  );
}

export async function createStoreOperation(input: {
  id: string;
  appId: string;
  action: StoreOperationAction;
  status: StoreOperationStatus;
  progressPercent: number;
  currentStep: string;
  errorMessage?: string | null;
  startedAt?: boolean;
}) {
  if (!(await hasTable("app_operations"))) return;

  await timedPgQuery(
    `INSERT INTO app_operations (
      id,
      app_id,
      action,
      status,
      progress_percent,
      current_step,
      error_message,
      started_at,
      finished_at,
      updated_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      CASE WHEN $8::boolean THEN NOW() ELSE NULL END,
      NULL,
      NOW()
    )`,
    [
      input.id,
      input.appId,
      input.action,
      input.status,
      input.progressPercent,
      input.currentStep,
      input.errorMessage ?? null,
      Boolean(input.startedAt),
    ],
  );
}

export async function updateStoreOperation(
  id: string,
  patch: Partial<
    Pick<
      StoreOperation,
      "status" | "progressPercent" | "currentStep" | "errorMessage" | "finishedAt"
    >
  > & {
    markStarted?: boolean;
    markFinished?: boolean;
  },
) {
  if (!(await hasTable("app_operations"))) return;

  await timedPgQuery(
    `UPDATE app_operations
    SET
      status = COALESCE($2, status),
      progress_percent = COALESCE($3, progress_percent),
      current_step = COALESCE($4, current_step),
      error_message = CASE
        WHEN $5::boolean THEN NULL
        ELSE COALESCE($6, error_message)
      END,
      started_at = CASE
        WHEN $7::boolean AND started_at IS NULL THEN NOW()
        ELSE started_at
      END,
      finished_at = CASE
        WHEN $8::boolean THEN NOW()
        ELSE finished_at
      END,
      updated_at = NOW()
    WHERE id = $1`,
    [
      id,
      patch.status ?? null,
      patch.progressPercent ?? null,
      patch.currentStep ?? null,
      patch.errorMessage === null,
      patch.errorMessage ?? null,
      Boolean(patch.markStarted),
      Boolean(patch.markFinished || patch.finishedAt),
    ],
  );
}

export async function findStoreOperationById(id: string): Promise<StoreOperation | null> {
  if (!(await hasTable("app_operations"))) {
    return null;
  }

  const result = await timedPgQuery<OperationRow>(
    `SELECT
      id,
      app_id,
      action,
      status,
      progress_percent,
      current_step,
      error_message,
      started_at,
      finished_at,
      updated_at
    FROM app_operations
    WHERE id = $1
    LIMIT 1`,
    [id],
  );

  const row = result.rows[0];
  return row ? mapOperationRow(row) : null;
}

export async function patchInstalledStackMeta(
  appId: string,
  input: {
    displayName?: string;
    iconUrl?: string | null;
  },
) {
  if (!(await hasTable("app_stacks"))) return;

  const sets: string[] = [];
  const values: unknown[] = [appId];

  if (input.displayName !== undefined) {
    values.push(input.displayName);
    sets.push(`display_name = $${values.length}`);
  }

  if (input.iconUrl !== undefined) {
    values.push(input.iconUrl ?? null);
    sets.push(`icon_url = $${values.length}`);
  }

  if (sets.length === 0) return;

  sets.push("updated_at = NOW()");

  await timedPgQuery(
    `UPDATE app_stacks SET ${sets.join(", ")} WHERE app_id = $1`,
    values,
  );
}
