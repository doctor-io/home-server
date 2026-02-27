import "server-only";

import { and, asc, desc, eq, isNull, ne, not, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { appOperations, appStacks } from "@/lib/server/db/schema";
import type {
  InstalledStackConfig,
  InstalledStackStatus,
  StoreOperation,
  StoreOperationAction,
  StoreOperationStatus,
} from "@/lib/shared/contracts/apps";

function toIso(value: Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
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
  if (
    action === "install" ||
    action === "redeploy" ||
    action === "uninstall" ||
    action === "start" ||
    action === "stop" ||
    action === "restart" ||
    action === "check-updates"
  ) {
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
  const check = await db.execute<{ table_exists: string | null }>(
    sql`SELECT to_regclass(${"public." + tableName}) AS table_exists`,
  );
  return Boolean(check.rows[0]?.table_exists);
}

function mapStackRow(row: {
  appId: string;
  templateName: string;
  stackName: string;
  composePath: string;
  status: string;
  webUiPort: number | null;
  envJson: unknown;
  displayName: string | null;
  iconUrl: string | null;
  installedAt: Date | null;
  updatedAt: Date;
  isUpToDate: boolean | null;
  lastUpdateCheck: Date | null;
  localDigest: string | null;
  remoteDigest: string | null;
}): InstalledStackConfig {
  return {
    appId: row.appId,
    templateName: row.templateName,
    stackName: row.stackName,
    composePath: row.composePath,
    status: toInstalledStackStatus(row.status),
    webUiPort: row.webUiPort,
    env: parseEnvJson(row.envJson),
    displayName: row.displayName ?? null,
    iconUrl: row.iconUrl ?? null,
    installedAt: toIso(row.installedAt),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    isUpToDate: row.isUpToDate ?? true,
    lastUpdateCheck: toIso(row.lastUpdateCheck),
    localDigest: row.localDigest ?? null,
    remoteDigest: row.remoteDigest ?? null,
  };
}

function mapOperationRow(row: {
  id: string;
  appId: string;
  action: string;
  status: string;
  progressPercent: number;
  currentStep: string;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  updatedAt: Date;
}): StoreOperation {
  return {
    id: row.id,
    appId: row.appId,
    action: toOperationAction(row.action),
    status: toOperationStatus(row.status),
    progressPercent: row.progressPercent,
    currentStep: row.currentStep,
    errorMessage: row.errorMessage,
    startedAt: toIso(row.startedAt),
    finishedAt: toIso(row.finishedAt),
    updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listInstalledStacksFromDb(): Promise<InstalledStackConfig[]> {
  if (!(await hasTable("app_stacks"))) return [];

  const rows = await db.select().from(appStacks).orderBy(asc(appStacks.appId));
  return rows.map(mapStackRow);
}

export async function findInstalledStackByAppId(
  appId: string,
): Promise<InstalledStackConfig | null> {
  if (!(await hasTable("app_stacks"))) return null;

  const rows = await db
    .select()
    .from(appStacks)
    .where(eq(appStacks.appId, appId))
    .limit(1);

  const row = rows[0];
  return row ? mapStackRow(row) : null;
}

export async function findStackByWebUiPort(
  port: number,
  options?: { excludeAppId?: string },
): Promise<InstalledStackConfig | null> {
  if (!(await hasTable("app_stacks"))) return null;

  const conditions = [
    eq(appStacks.webUiPort, port),
    not(eq(appStacks.status, "not_installed")),
  ];

  if (options?.excludeAppId) {
    conditions.push(ne(appStacks.appId, options.excludeAppId));
  }

  const rows = await db
    .select()
    .from(appStacks)
    .where(and(...conditions))
    .limit(1);

  const row = rows[0];
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

  await db
    .insert(appStacks)
    .values({
      appId: input.appId,
      templateName: input.templateName,
      stackName: input.stackName,
      composePath: input.composePath,
      status: input.status,
      webUiPort: input.webUiPort,
      envJson: input.env,
      installedAt: input.markInstalledAt ? sql`NOW()` : null,
      updatedAt: sql`NOW()`,
    })
    .onConflictDoUpdate({
      target: appStacks.appId,
      set: {
        templateName: input.templateName,
        stackName: input.stackName,
        composePath: input.composePath,
        status: input.status,
        webUiPort: input.webUiPort,
        envJson: input.env,
        installedAt: input.markInstalledAt
          ? sql`CASE WHEN ${appStacks.installedAt} IS NULL THEN NOW() ELSE ${appStacks.installedAt} END`
          : sql`${appStacks.installedAt}`,
        updatedAt: sql`NOW()`,
      },
    });
}

export async function deleteInstalledStackByAppId(appId: string) {
  if (!(await hasTable("app_stacks"))) return;

  await db.delete(appStacks).where(eq(appStacks.appId, appId));
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

  await db.insert(appOperations).values({
    id: input.id,
    appId: input.appId,
    action: input.action,
    status: input.status,
    progressPercent: input.progressPercent,
    currentStep: input.currentStep,
    errorMessage: input.errorMessage ?? null,
    startedAt: input.startedAt ? sql`NOW()` : null,
    finishedAt: null,
    updatedAt: sql`NOW()`,
  });
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

  type SetValues = Record<string, unknown>;
  const set: SetValues = { updatedAt: sql`NOW()` };

  if (patch.status !== undefined) set.status = patch.status;
  if (patch.progressPercent !== undefined) set.progressPercent = patch.progressPercent;
  if (patch.currentStep !== undefined) set.currentStep = patch.currentStep;

  if (patch.errorMessage === null) {
    set.errorMessage = null;
  } else if (patch.errorMessage !== undefined) {
    set.errorMessage = patch.errorMessage;
  }

  if (patch.markStarted) {
    set.startedAt = sql`CASE WHEN ${appOperations.startedAt} IS NULL THEN NOW() ELSE ${appOperations.startedAt} END`;
  }

  if (patch.markFinished || patch.finishedAt) {
    set.finishedAt = sql`NOW()`;
  }

  await db.update(appOperations).set(set).where(eq(appOperations.id, id));
}

export async function findStoreOperationById(id: string): Promise<StoreOperation | null> {
  if (!(await hasTable("app_operations"))) return null;

  const rows = await db
    .select()
    .from(appOperations)
    .where(eq(appOperations.id, id))
    .limit(1);

  const row = rows[0];
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
  if (input.displayName === undefined && input.iconUrl === undefined) return;

  type SetValues = Record<string, unknown>;
  const set: SetValues = { updatedAt: sql`NOW()` };

  if (input.displayName !== undefined) set.displayName = input.displayName;
  if (input.iconUrl !== undefined) set.iconUrl = input.iconUrl ?? null;

  await db.update(appStacks).set(set).where(eq(appStacks.appId, appId));
}

export async function updateStackUpdateStatus(input: {
  appId: string;
  isUpToDate: boolean;
  localDigest: string | null;
  remoteDigest: string | null;
}) {
  if (!(await hasTable("app_stacks"))) return;

  await db
    .update(appStacks)
    .set({
      isUpToDate: input.isUpToDate,
      localDigest: input.localDigest,
      remoteDigest: input.remoteDigest,
      lastUpdateCheck: sql`NOW()`,
      updatedAt: sql`NOW()`,
    })
    .where(eq(appStacks.appId, input.appId));
}
