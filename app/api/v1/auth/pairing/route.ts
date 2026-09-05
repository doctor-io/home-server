import { NextResponse } from "next/server";
import { toString as qrCodeToString } from "qrcode";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createPairingCode,
  purgeStalePairingCodes,
} from "@/lib/server/modules/auth/pairing-service";
import {
  createRequestId,
  logServerAction,
  withServerTiming,
} from "@/lib/server/logging/logger";

export const runtime = "nodejs";

/**
 * What the phone scans. A custom scheme rather than an https URL, so a generic
 * QR reader opens nothing and only the app can act on it — and the address
 * travels with the code, because a phone that has to be told the tailnet name
 * by hand has not been saved any typing.
 */
function pairingUrl(origin: string, code: string) {
  return `homeio://pair?server=${encodeURIComponent(origin)}&code=${encodeURIComponent(code)}`;
}

/**
 * The address the browser actually used, taken from the request headers.
 *
 * `new URL(request.url).origin` cannot be used here: with a custom server, Next
 * builds that from its own bind address, so it answers "http://localhost:3000"
 * whatever Host the client sent. The QR then told the phone to connect to
 * localhost — which, on a phone, is the phone.
 *
 * Host is client-controlled, but the only client here is the authenticated
 * operator asking for their own pairing code, so a forged value can misdirect
 * nobody but themselves.
 */
function requestOrigin(request: Request) {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;

  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  if (!host) return new URL(request.url).origin;

  const proto =
    first(request.headers.get("x-forwarded-proto")) ??
    new URL(request.url).protocol.replace(":", "");

  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const apiSession = await requireApiSession(request);
  if (apiSession.response) return apiSession.response;
  const requestId = createRequestId();

  try {
    return await withServerTiming(
      { layer: "api", action: "auth.pairing.create", requestId },
      async () => {
        void purgeStalePairingCodes().catch(() => {});

        const { code, expiresAt } = await createPairingCode(apiSession.session.userId);

        // Whatever reaches this browser reaches the phone on the same network,
        // and guessing a public hostname from the server side gets it wrong
        // behind a tunnel.
        const origin = requestOrigin(request);
        const url = pairingUrl(origin, code);

        return NextResponse.json(
          {
            data: {
              url,
              expiresAt: expiresAt.toISOString(),
              qrSvg: await qrCodeToString(url, {
                type: "svg",
                errorCorrectionLevel: "M",
                margin: 1,
              }),
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    );
  } catch (error) {
    logServerAction({
      level: "error",
      layer: "api",
      action: "auth.pairing.create.response",
      status: "error",
      requestId,
      message: "Unable to create a pairing code",
      error,
    });

    return NextResponse.json(
      { error: "Unable to create a pairing code", code: "internal_error" },
      { status: 500 },
    );
  }
}
