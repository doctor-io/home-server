import "server-only";

import { logServerAction } from "@/lib/server/logging/logger";
import { readPushConfig, type PushConfig } from "@/lib/server/modules/notifications/push-config";
import type { NotificationKind, NotificationRecord } from "@/lib/shared/contracts/notifications";

/**
 * A transport is anything that can put a notification on a phone. ntfy is the
 * first and the default; the roadmap keeps room for a second (FCM, or a hosted
 * relay) behind this same shape, so nothing above this line has to change when
 * one arrives.
 */
export type PushTransport = {
  readonly name: string;
  send(notification: NotificationRecord, config: PushConfig): Promise<void>;
};

/** A push that hangs is worse than one that fails: the caller is a notification. */
const PUSH_TIMEOUT_MS = 5_000;

/**
 * ntfy reads priority and tags from headers, so a crashed container arrives
 * looking urgent and a routine message does not wake anybody at 3am.
 */
function ntfyHeadersFor(kind: NotificationKind) {
  // Three kinds, not four: the contract has info, success and error, and a
  // "warning" tier invented here would never be produced by anything.
  switch (kind) {
    case "error":
      return { priority: 5, tags: "rotating_light" };
    case "success":
      return { priority: 3, tags: "white_check_mark" };
    default:
      return { priority: 2, tags: "information_source" };
  }
}

/**
 * Header values must be Latin-1 and single-line, and a notification body is
 * neither: container names carry unicode, and log excerpts carry newlines. ntfy
 * accepts a JSON body instead, which has no such rule — so that is what this
 * sends, and the title never has to be mangled to fit a header.
 */
export const ntfyTransport: PushTransport = {
  name: "ntfy",

  async send(notification, config) {
    if (!config.ntfyTopic) return;

    const { priority, tags } = ntfyHeadersFor(notification.kind);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PUSH_TIMEOUT_MS);

    try {
      const response = await fetch(config.ntfyUrl.replace(/\/+$/, ""), {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(config.ntfyToken ? { Authorization: `Bearer ${config.ntfyToken}` } : {}),
        },
        body: JSON.stringify({
          topic: config.ntfyTopic,
          title: notification.title,
          message: notification.body,
          priority,
          tags: [tags],
        }),
      });

      if (!response.ok) {
        throw new Error(`ntfy answered ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  },
};

/**
 * Deliver a notification to the phone, if push is on and configured.
 *
 * **This never throws.** It is called from createNotification, where the row is
 * already written and the SSE stream has already fired — a failed push must not
 * undo a notification that exists, and an unreachable ntfy must not take down
 * the thing that was trying to report a problem in the first place.
 */
export async function dispatchPush(
  notification: NotificationRecord,
  transport: PushTransport = ntfyTransport,
): Promise<void> {
  try {
    const config = await readPushConfig();
    if (!config.enabled || !config.ntfyTopic) return;

    await transport.send(notification, config);

    logServerAction({
      level: "debug",
      layer: "service",
      action: "notifications.push.sent",
      status: "success",
      meta: { transport: transport.name, kind: notification.kind },
    });
  } catch (error) {
    logServerAction({
      level: "warn",
      layer: "service",
      action: "notifications.push.failed",
      status: "error",
      message: "Could not deliver a push notification",
      error,
      meta: { transport: transport.name },
    });
  }
}
