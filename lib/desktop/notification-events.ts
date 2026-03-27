export const DESKTOP_NOTIFICATION_EVENT = "homeio:desktop-notification";

export type DesktopNotificationEventDetail = {
  id: string;
  title: string;
  message: string;
  kind?: "backup-report";
  createdAt?: string;
  read?: boolean;
};

export function dispatchDesktopNotificationEvent(
  detail: DesktopNotificationEventDetail,
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<DesktopNotificationEventDetail>(DESKTOP_NOTIFICATION_EVENT, {
      detail,
    }),
  );
}
