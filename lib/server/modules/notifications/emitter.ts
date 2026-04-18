import "server-only";

import type { NotificationRecord, NotificationSseEvent } from "@/lib/shared/contracts/notifications";

type NotificationSubscriber = (event: NotificationSseEvent) => void;

const subscribers = new Set<NotificationSubscriber>();

export function subscribeToNotifications(callback: NotificationSubscriber): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

export function emitNotification(notification: NotificationRecord) {
  const event: NotificationSseEvent = { type: "notification.created", notification };
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

export function emitNotificationReadAll() {
  const event: NotificationSseEvent = { type: "notification.read-all" };
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}

export function emitNotificationCleared() {
  const event: NotificationSseEvent = { type: "notification.cleared" };
  for (const subscriber of subscribers) {
    subscriber(event);
  }
}
