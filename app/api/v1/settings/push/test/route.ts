import { NextResponse } from "next/server";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import { readPushConfig } from "@/lib/server/modules/notifications/push-config";
import {
  describePushFailure,
  ntfyTransport,
} from "@/lib/server/modules/notifications/push-service";

export const runtime = "nodejs";

/**
 * Send one notification through the saved config, and report what ntfy said.
 *
 * This is the opposite of `dispatchPush`, on purpose: that one swallows every
 * failure because a real notification must not be undone by a bad push, while
 * this one exists precisely to surface the failure — an operator pressing
 * "Send test" is asking whether it works, and "nothing happened" is not an
 * answer they can act on.
 *
 * It ignores the enabled flag so a topic can be proven before push is armed.
 */
export async function POST(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const config = await readPushConfig();
    if (!config.ntfyTopic) {
      return NextResponse.json(
        { error: "Save a topic first", code: "validation_error" },
        { status: 400 },
      );
    }

    await ntfyTransport.send(
      {
        id: `test-${requestId}`,
        title: "Homeio test notification",
        body: "Push is wired up. Real alerts will arrive here.",
        kind: "success",
        read: false,
        createdAt: new Date().toISOString(),
      },
      config,
    );

    logServerAction({
      level: "info",
      layer: "api",
      action: "settings.push.test",
      status: "success",
      requestId,
    });

    return NextResponse.json(
      { data: { delivered: true } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logServerAction({
      level: "warn",
      layer: "api",
      action: "settings.push.test",
      status: "error",
      requestId,
      message: "Test push was not delivered",
      error: err,
    });

    // The reason is the whole point of the button: a wrong token answers 403, a
    // typo'd host does not resolve, and each needs a different fix.
    const config = await readPushConfig().catch(() => null);
    const reason = describePushFailure(err, config?.ntfyUrl ?? "the push server");
    return NextResponse.json({ error: reason, code: "push_failed" }, { status: 502 });
  }
}
