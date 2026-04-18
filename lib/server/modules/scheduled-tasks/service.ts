import "server-only";

import { randomUUID } from "node:crypto";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { db } from "@/lib/server/db/drizzle";
import { scheduledTasks } from "@/lib/server/db/schema";
import type {
  CreateScheduledTaskInput,
  ScheduledTaskRecord,
  UpdateScheduledTaskInput,
} from "@/lib/shared/contracts/scheduled-tasks";
import { SHELL_COMMAND_ALLOWLIST } from "@/lib/shared/contracts/scheduled-tasks";
import { desc, eq, lte, and, isNotNull } from "drizzle-orm";
import { nextCronRun } from "./cron";
import { createNotification } from "@/lib/server/modules/notifications/service";
import { runSystemBackupNow } from "@/lib/server/modules/system/backup-service";
import { findInstalledStackByAppId } from "@/lib/server/modules/apps/stacks-repository";
import { runComposeRestart, runComposePull } from "@/lib/server/modules/docker/compose-runner";
import { listInstalledStacksFromDb } from "@/lib/server/modules/apps/stacks-repository";

const execAsync = promisify(exec);

function toRecord(row: typeof scheduledTasks.$inferSelect): ScheduledTaskRecord {
  return {
    id: row.id,
    label: row.label,
    taskType: row.taskType as ScheduledTaskRecord["taskType"],
    taskConfig: row.taskConfig as ScheduledTaskRecord["taskConfig"],
    cronExpression: row.cronExpression,
    enabled: row.enabled,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastRunStatus: row.lastRunStatus as ScheduledTaskRecord["lastRunStatus"],
    lastRunOutput: row.lastRunOutput,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listScheduledTasks(): Promise<ScheduledTaskRecord[]> {
  const rows = await db
    .select()
    .from(scheduledTasks)
    .orderBy(desc(scheduledTasks.createdAt));
  return rows.map(toRecord);
}

export async function getScheduledTask(id: string): Promise<ScheduledTaskRecord | null> {
  const rows = await db.select().from(scheduledTasks).where(eq(scheduledTasks.id, id)).limit(1);
  return rows[0] ? toRecord(rows[0]) : null;
}

export async function createScheduledTask(
  input: CreateScheduledTaskInput,
): Promise<ScheduledTaskRecord> {
  const id = randomUUID();
  const nextRunAt = nextCronRun(input.cronExpression, new Date());
  const [row] = await db
    .insert(scheduledTasks)
    .values({
      id,
      label: input.label,
      taskType: input.taskType,
      taskConfig: input.taskConfig,
      cronExpression: input.cronExpression,
      enabled: input.enabled ?? true,
      nextRunAt: nextRunAt ?? undefined,
    })
    .returning();
  return toRecord(row);
}

export async function updateScheduledTask(
  id: string,
  input: UpdateScheduledTaskInput,
): Promise<ScheduledTaskRecord | null> {
  const existing = await getScheduledTask(id);
  if (!existing) return null;

  const cronExpression = input.cronExpression ?? existing.cronExpression;
  const nextRunAt = nextCronRun(cronExpression, new Date());

  const [row] = await db
    .update(scheduledTasks)
    .set({
      ...(input.label !== undefined && { label: input.label }),
      ...(input.taskType !== undefined && { taskType: input.taskType }),
      ...(input.taskConfig !== undefined && { taskConfig: input.taskConfig }),
      ...(input.cronExpression !== undefined && { cronExpression: input.cronExpression }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      nextRunAt: nextRunAt ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(scheduledTasks.id, id))
    .returning();

  return row ? toRecord(row) : null;
}

export async function deleteScheduledTask(id: string): Promise<void> {
  await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
}

export async function getDueTasks(): Promise<ScheduledTaskRecord[]> {
  const now = new Date();
  const rows = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.enabled, true),
        isNotNull(scheduledTasks.nextRunAt),
        lte(scheduledTasks.nextRunAt, now),
      ),
    );
  return rows.map(toRecord);
}

export async function runScheduledTask(id: string): Promise<void> {
  const task = await getScheduledTask(id);
  if (!task) return;

  let status: "success" | "error" = "success";
  let output = "";

  try {
    if (task.taskConfig.type === "shell") {
      const command = task.taskConfig.command;
      const allowed = (SHELL_COMMAND_ALLOWLIST as readonly string[]).includes(command);
      if (!allowed) throw new Error(`Command not allowed: ${command}`);
      const result = await execAsync(command, { timeout: 30_000 });
      output = (result.stdout + result.stderr).trim().slice(0, 2000);
    } else if (task.taskConfig.type === "restart-app") {
      const stack = await findInstalledStackByAppId(task.taskConfig.appId);
      if (!stack) throw new Error(`App not found: ${task.taskConfig.appId}`);
      await runComposeRestart({
        composePath: stack.composePath,
        envPath: path.join(path.dirname(stack.composePath), ".env"),
        stackName: stack.stackName,
      });
      output = `Restarted ${task.taskConfig.appName}`;
    } else if (task.taskConfig.type === "backup") {
      await runSystemBackupNow();
      output = "Backup completed";
    } else if (task.taskConfig.type === "pull-images") {
      const stacks = await listInstalledStacksFromDb();
      for (const stack of stacks) {
        if (!stack.composePath) continue;
        await runComposePull({
          composePath: stack.composePath,
          envPath: path.join(path.dirname(stack.composePath), ".env"),
          stackName: stack.stackName,
        }).catch(() => undefined);
      }
      output = `Pulled images for ${stacks.length} stacks`;
    }
  } catch (err) {
    status = "error";
    output = err instanceof Error ? err.message : String(err);

    createNotification({
      title: `Scheduled task failed: ${task.label}`,
      body: output.slice(0, 300),
      kind: "error",
    }).catch(() => undefined);
  }

  const nextRunAt = nextCronRun(task.cronExpression, new Date());
  await db
    .update(scheduledTasks)
    .set({
      lastRunAt: new Date(),
      lastRunStatus: status,
      lastRunOutput: output,
      nextRunAt: nextRunAt ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(scheduledTasks.id, id));
}
