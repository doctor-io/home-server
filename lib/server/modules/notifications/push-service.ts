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
 * The tag that tells the app this push carries nothing worth reading.
 *
 * An app too old to know it simply shows the generic text below — degraded,
 * never broken, which is the only acceptable failure mode for a phone that
 * updates on its own schedule.
 */
export const PING_TAG = "homeio-ping";

/**
 * What a push says when the operator has chosen not to hand the relay their
 * alert text. It is deliberately identical for every notification: a relay that
 * can see "Jellyfin stopped" can see rather a lot about a household.
 */
const PING_TITLE = "Homeio";
const PING_MESSAGE = "New notification — open Homeio to read it";

/**
 * Priority survives ping mode, and that is a considered leak: it is what
 * decides whether the phone buzzes at 3am, and a push that cannot distinguish
 * a crashed container from a finished backup is not an alerting system. What
 * escapes is one of three severity levels, with no subject attached.
 */
function payloadFor(notification: NotificationRecord, config: PushConfig) {
  const { priority, tags } = ntfyHeadersFor(notification.kind);

  if (config.includeContent) {
    return { title: notification.title, message: notification.body, priority, tags: [tags] };
  }

  return { title: PING_TITLE, message: PING_MESSAGE, priority, tags: [tags, PING_TAG] };
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

    const payload = payloadFor(notification, config);
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
        body: JSON.stringify({ topic: config.ntfyTopic, ...payload }),
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
 * Turn a fetch failure into something an operator can act on.
 *
 * Node answers a refused connection or an unresolvable host with a bare
 * "fetch failed" and hides the real reason on `cause`, which tells whoever
 * pressed "Send test" nothing at all — and the whole point of that button is
 * to say which of the two happened.
 */
export function describePushFailure(error: unknown, url: string): string {
  if (!(error instanceof Error)) return `Could not reach ${url}`;

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return `${url} did not answer within ${PUSH_TIMEOUT_MS / 1000} seconds`;
  }

  const cause: unknown = (error as { cause?: unknown }).cause;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? String((cause as { code: unknown }).code)
      : null;

  if (code) return `Could not reach ${url} (${code})`;
  if (error.message === "fetch failed") return `Could not reach ${url}`;

  return error.message;
}

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
