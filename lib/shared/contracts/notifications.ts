export type NotificationKind = "info" | "success" | "error";

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  kind: NotificationKind;
  read: boolean;
  createdAt: string;
};

export type NotificationsListResponse = {
  notifications: NotificationRecord[];
};

export type NotificationSseEvent =
  | { type: "notification.created"; notification: NotificationRecord }
  | { type: "notification.read-all" }
  | { type: "notification.cleared" };
