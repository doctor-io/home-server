import { NextResponse } from "next/server";
import { createRequestId, logServerAction } from "@/lib/server/logging/logger";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  readPushConfig,
  toPublicPushConfig,
  writePushConfig,
} from "@/lib/server/modules/notifications/push-config";
import { normalizeNtfyUrl, validateNtfyTopic } from "@/lib/shared/push";
import type { PushConfigSaveRequest } from "@/lib/shared/contracts/push";

export const runtime = "nodejs";

/**
 * Never cacheable, and this is not a detail: a proxy that applies a default
 * max-age to a JSON GET will happily serve yesterday's push config for a day —
 * which is exactly what happened on a live server, leaving the phone's switch
 * insisting push was off minutes after it had been turned on.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    return NextResponse.json(
      { data: toPublicPushConfig(await readPushConfig()) },
      { headers: NO_STORE },
    );
  } catch (err) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "settings.push.get",
      status: "error",
      requestId,
      message: "Failed to read push config",
      error: err,
    });
    return NextResponse.json({ error: "Failed to read config", code: "internal_error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;

  const requestId = createRequestId();
  try {
    const body = (await request.json()) as Partial<PushConfigSaveRequest>;
    const enabled = body.enabled === true;
    const topic = typeof body.ntfyTopic === "string" ? body.ntfyTopic.trim() : "";

    // A topic is required to turn push on — armed-and-going-nowhere is the worst
    // state for an alerting feature — but an operator may save a topic with push
    // still off, which is how they test one before arming it.
    const topicError = topic ? validateNtfyTopic(topic) : enabled ? "Enter a topic" : null;
    if (topicError) {
      return NextResponse.json({ error: topicError, code: "validation_error" }, { status: 400 });
    }

    const url = normalizeNtfyUrl(typeof body.ntfyUrl === "string" ? body.ntfyUrl : "");
    if (!url) {
      return NextResponse.json(
        { error: "Enter an http:// or https:// address", code: "validation_error" },
        { status: 400 },
      );
    }

    await writePushConfig({
      enabled,
      ntfyUrl: url,
      ntfyTopic: topic || null,
      // Opt-in, never inferred: handing the relay the alert text is a decision
      // the operator makes, so anything but an explicit true stays off.
      includeContent: body.includeContent === true,
      // Undefined keeps whatever is stored; the UI only sends this key when the
      // operator typed a new token or asked to remove the one there.
      ntfyToken:
        body.ntfyToken === undefined
          ? undefined
          : body.ntfyToken === null || body.ntfyToken.trim() === ""
            ? null
            : body.ntfyToken.trim(),
    });

    return NextResponse.json(
      { data: toPublicPushConfig(await readPushConfig()) },
      { headers: NO_STORE },
    );
  } catch (err) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "settings.push.put",
      status: "error",
      requestId,
      message: "Failed to save push config",
      error: err,
    });
    return NextResponse.json({ error: "Failed to save config", code: "internal_error" }, { status: 500 });
  }
}
