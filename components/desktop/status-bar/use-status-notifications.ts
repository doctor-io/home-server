"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, formatRelativeTime } from "@/components/desktop/status-bar/utils";
import type { Notification } from "@/components/desktop/status-bar/types";

const ALERT_COOLDOWN_MS = 60_000;
const MAX_NOTIFICATIONS = 12;

type StoredNotification = Omit<Notification, "time"> & {
  createdAt: string;
};

type UseStatusNotificationsParams = {
  metricsTimestamp: string | null;
  cpuPercent: number;
  memoryPercent: number;
  hostname: string;
  uptimeSeconds: number;
  stoppedAppsCount: number;
  username: string | undefined;
};

function toEventTimestamp(timestamp: string | null) {
  if (!timestamp) return new Date().toISOString();
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return new Date().toISOString();
  return new Date(parsed).toISOString();
}

function upsertNotification(
  items: StoredNotification[],
  nextItem: StoredNotification,
  options?: {
    preserveRead?: boolean;
    preserveCreatedAt?: boolean;
  },
) {
  const index = items.findIndex((item) => item.id === nextItem.id);

  if (index === -1) {
    items.push(nextItem);
    return;
  }

  const existing = items[index];
  items[index] = {
    ...nextItem,
    read: options?.preserveRead ? existing.read : nextItem.read,
    createdAt: options?.preserveCreatedAt ? existing.createdAt : nextItem.createdAt,
  };
}

function removeNotification(items: StoredNotification[], id: string) {
  const index = items.findIndex((item) => item.id === id);
  if (index !== -1) {
    items.splice(index, 1);
  }
}

export function useStatusNotifications({
  metricsTimestamp,
  cpuPercent,
  memoryPercent,
  hostname,
  uptimeSeconds,
  stoppedAppsCount,
  username,
}: UseStatusNotificationsParams) {
  const [storedNotifications, setStoredNotifications] = useState<StoredNotification[]>([]);
  const lastAlertAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const eventTimestamp = toEventTimestamp(metricsTimestamp);
    const eventTimeMs = Date.parse(eventTimestamp);

    setStoredNotifications((previous) => {
      const next = [...previous];

      if (metricsTimestamp) {
        upsertNotification(
          next,
          {
            id: "system-snapshot",
            title: "System Snapshot",
            message: `${hostname} · uptime ${formatDuration(uptimeSeconds)}`,
            read: true,
            createdAt: eventTimestamp,
          },
          { preserveCreatedAt: true },
        );
      } else {
        removeNotification(next, "system-snapshot");
      }

      if (stoppedAppsCount > 0) {
        upsertNotification(
          next,
          {
            id: "apps-stopped",
            title: "Apps Attention",
            message: `${stoppedAppsCount} app(s) are stopped`,
            read: false,
            createdAt: eventTimestamp,
          },
          {
            preserveRead: true,
            preserveCreatedAt: true,
          },
        );
      } else {
        removeNotification(next, "apps-stopped");
      }

      if (username) {
        upsertNotification(
          next,
          {
            id: "session",
            title: "Active Session",
            message: `Signed in as ${username}`,
            read: true,
            createdAt: eventTimestamp,
          },
          { preserveCreatedAt: true },
        );
      } else {
        removeNotification(next, "session");
      }

      const maybeCreateAlert = (
        type: "cpu-warning" | "memory-warning",
        isActive: boolean,
        title: string,
        message: string,
      ) => {
        if (!isActive || Number.isNaN(eventTimeMs)) return;

        const lastAlertAt = lastAlertAtRef.current[type] ?? 0;
        if (eventTimeMs - lastAlertAt < ALERT_COOLDOWN_MS) return;

        lastAlertAtRef.current[type] = eventTimeMs;
        next.push({
          id: `${type}-${eventTimeMs}`,
          title,
          message,
          read: false,
          createdAt: eventTimestamp,
        });
      };

      maybeCreateAlert(
        "memory-warning",
        memoryPercent >= 85,
        "Memory Warning",
        `Memory usage is high at ${memoryPercent}%`,
      );

      maybeCreateAlert(
        "cpu-warning",
        cpuPercent >= 85,
        "CPU Warning",
        `CPU load peaked at ${cpuPercent}%`,
      );

      next.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
      return next.slice(0, MAX_NOTIFICATIONS);
    });
  }, [
    cpuPercent,
    hostname,
    memoryPercent,
    metricsTimestamp,
    stoppedAppsCount,
    uptimeSeconds,
    username,
  ]);

  const markAllRead = useCallback(() => {
    setStoredNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        read: true,
      })),
    );
  }, []);

  const clearAll = useCallback(() => {
    setStoredNotifications([]);
  }, []);

  const notifications = useMemo<Notification[]>(
    () =>
      storedNotifications.map((item) => ({
        id: item.id,
        title: item.title,
        message: item.message,
        read: item.read,
        time: formatRelativeTime(item.createdAt),
      })),
    [storedNotifications],
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    markAllRead,
    clearAll,
  };
}
