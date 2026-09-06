import { NextResponse } from "next/server";
import { toString as qrCodeToString } from "qrcode";
import { requireApiSession } from "@/lib/server/modules/auth/api";
import {
  createPairingCode,
  purgeStalePairingCodes,
} from "@/lib/server/modules/auth/pairing-service";
import {
  choosePairingOrigin,
  isPhoneReachable,
  requestOrigin,
} from "@/lib/server/modules/auth/pairing-origin";
import { getLocalTailscaleStatus } from "@/lib/server/modules/integrations/tailscale-status";
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
        // behind a tunnel — with one exception: a browser on the machine itself
        // reports localhost, which on a phone is the phone. Only then is the
        // tailnet name worth the cost of asking for it.
        const browserOrigin = requestOrigin(request);
        const dnsName = isPhoneReachable(browserOrigin)
          ? null
          : await getLocalTailscaleStatus()
              .then((status) => status.dnsName)
              .catch(() => null);

        const { origin, reachable, reason } = choosePairingOrigin(browserOrigin, dnsName);
        const url = pairingUrl(origin, code);

        return NextResponse.json(
          {
            data: {
              url,
              // The card shows this, because a QR nobody can read is the one
              // place a wrong address hides until someone scans it.
              origin,
              reachable,
              reason,
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
