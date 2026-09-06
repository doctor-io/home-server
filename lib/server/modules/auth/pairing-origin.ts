/**
 * Which address to put in a pairing QR.
 *
 * The QR carries the address the operator's browser used, which is right in
 * every case but one: when they are looking at Homeio from the machine it runs
 * on. `http://localhost:3000` scanned by a phone means *the phone*, so the code
 * is spent against a server that does not exist and the pairing fails with
 * nothing to explain it.
 *
 * Homeio already knows an address that reaches a phone — its tailnet name — so
 * that is what goes in the QR instead. When there is no tailnet either, the
 * answer is to say so rather than to encode something that cannot work.
 */

/** The direct-run port, which the installer's nginx sits in front of on 80. */
const DIRECT_PORT = "3000";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/** Why a phone would not get anywhere with this address, or null if it would. */
export type UnreachableReason = "loopback" | "mdns";

export function phoneUnreachableReason(origin: string): UnreachableReason | null {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    return "loopback";
  }

  if (LOOPBACK_HOSTS.has(hostname)) return "loopback";

  // mDNS. It resolves reliably on a Mac and not at all on much of Android, so a
  // QR carrying one works on the machine that made it and fails on the phone it
  // was made for — which is the exact shape of bug this module exists to stop.
  if (hostname.endsWith(".local")) return "mdns";

  return null;
}

/** Whether an address means anything to a device that is not this machine. */
export function isPhoneReachable(origin: string): boolean {
  return phoneUnreachableReason(origin) === null;
}

/**
 * The same server, named the way a phone can reach it.
 *
 * `tailscale status` reports a fully-qualified name with a trailing dot; a URL
 * built from that works but reads like a typo on screen, so it comes off.
 *
 * The port is carried over, except when it is 3000 — that is the port Homeio
 * listens on when run directly, and the installer puts nginx in front of it on
 * 80, so the phone's copy is almost never on 3000. Dropping it lets the app try
 * 80 first and 3000 second, which is exactly what it does for an address typed
 * without a port. Any other port was a deliberate choice and is kept.
 */
export function tailnetOrigin(browserOrigin: string, dnsName: string | null): string | null {
  const name = dnsName?.replace(/\.$/, "").trim();
  if (!name) return null;

  let port = "";
  try {
    const url = new URL(browserOrigin);
    if (url.port && url.port !== DIRECT_PORT) port = `:${url.port}`;
  } catch {
    // An unparseable browser origin says nothing about the port; the tailnet
    // name on its own is still better than a loopback address.
  }

  return `http://${name}${port}`;
}

export type PairingOrigin = {
  origin: string;
  /** False when the address in the QR cannot work from a phone, and we know it. */
  reachable: boolean;
  /** Why not, so the card can say something specific rather than something vague. */
  reason?: UnreachableReason;
};

/**
 * Pick the address for the QR: the browser's, unless that is this machine
 * talking to itself, in which case the tailnet name if there is one.
 */
export function choosePairingOrigin(
  browserOrigin: string,
  dnsName: string | null,
): PairingOrigin {
  const reason = phoneUnreachableReason(browserOrigin);
  if (reason === null) return { origin: browserOrigin, reachable: true };

  const tailnet = tailnetOrigin(browserOrigin, dnsName);
  if (tailnet) return { origin: tailnet, reachable: true };

  // Nothing better exists. The QR is still issued — the operator may be about
  // to fix their setup, and a code they can read beats a blank card — but the
  // UI is told it will not work so it can say why.
  return { origin: browserOrigin, reachable: false, reason };
}

/**
 * The address the browser actually used, taken from the request headers.
 *
 * `new URL(request.url).origin` cannot be used: with a custom server, Next
 * builds that from its own bind address and answers "http://localhost:3000"
 * whatever Host the client sent.
 *
 * The scheme is the fiddly half. Behind a tunnel the TLS ends at the edge and
 * the origin is spoken to in plain HTTP, so `$scheme` at the proxy is http and
 * a QR built from it tells the phone to use http for an https server. Every
 * header a proxy might use to say otherwise is consulted before believing that.
 *
 * Host and these headers are client-controlled, but the only client here is the
 * authenticated operator asking for their own pairing code, so a forged value
 * can misdirect nobody but themselves.
 */
export function requestOrigin(request: Request): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || null;

  const host = first(request.headers.get("x-forwarded-host")) ?? first(request.headers.get("host"));
  if (!host) return new URL(request.url).origin;

  return `${forwardedProtocol(request)}://${host}`;
}

function forwardedProtocol(request: Request): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim().toLowerCase() || null;

  const forwarded = first(request.headers.get("x-forwarded-proto"));
  if (forwarded) return forwarded;

  // Cloudflare's own, sent as JSON: {"scheme":"https"}.
  const visitor = request.headers.get("cf-visitor");
  if (visitor) {
    try {
      const scheme = (JSON.parse(visitor) as { scheme?: string }).scheme?.toLowerCase();
      if (scheme === "https" || scheme === "http") return scheme;
    } catch {
      // Not JSON, so not something to trust.
    }
  }

  // Older proxies, and nginx configured the long way round.
  if (first(request.headers.get("x-forwarded-ssl")) === "on") return "https";
  if (first(request.headers.get("front-end-https")) === "on") return "https";

  return new URL(request.url).protocol.replace(":", "");
}
