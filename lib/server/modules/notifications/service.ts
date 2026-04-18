import "server-only";

import { randomUUID } from "node:crypto";
import { db } from "@/lib/server/db/drizzle";
import { notifications } from "@/lib/server/db/schema";
import type { NotificationKind, NotificationRecord } from "@/lib/shared/contracts/notifications";
import { desc, eq } from "drizzle-orm";
import { emitNotification, emitNotificationCleared, emitNotificationReadAll } from "./emitter";

const MAX_NOTIFICATIONS = 50;

function toRecord(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    kind: row.kind as NotificationKind,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listNotifications(): Promise<NotificationRecord[]> {
  const rows = await db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(MAX_NOTIFICATIONS);
  return rows.map(toRecord);
}

export async function createNotification(input: {
  title: string;
  body: string;
  kind?: NotificationKind;
}): Promise<NotificationRecord> {
  const id = randomUUID();
  const [row] = await db
    .insert(notifications)
    .values({
      id,
      title: input.title,
      body: input.body,
      kind: input.kind ?? "info",
      read: false,
    })
    .returning();

  const record = toRecord(row);
  emitNotification(record);

  // Prune old rows non-blocking
  void pruneOldNotifications().catch(() => undefined);

  return record;
}

export async function markAllNotificationsRead(): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.read, false));
  emitNotificationReadAll();
}

export async function clearAllNotifications(): Promise<void> {
  await db.delete(notifications);
  emitNotificationCleared();
}

async function pruneOldNotifications() {
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .offset(MAX_NOTIFICATIONS);
  if (rows.length === 0) return;
  for (const row of rows) {
    await db.delete(notifications).where(eq(notifications.id, row.id));
  }
}
