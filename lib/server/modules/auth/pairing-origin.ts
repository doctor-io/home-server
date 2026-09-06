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

/** Whether an address means anything to a device that is not this machine. */
export function isPhoneReachable(origin: string): boolean {
  try {
    return !LOOPBACK_HOSTS.has(new URL(origin).hostname.toLowerCase());
  } catch {
    return false;
  }
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
};

/**
 * Pick the address for the QR: the browser's, unless that is this machine
 * talking to itself, in which case the tailnet name if there is one.
 */
export function choosePairingOrigin(
  browserOrigin: string,
  dnsName: string | null,
): PairingOrigin {
  if (isPhoneReachable(browserOrigin)) return { origin: browserOrigin, reachable: true };

  const tailnet = tailnetOrigin(browserOrigin, dnsName);
  if (tailnet) return { origin: tailnet, reachable: true };

  // Nothing better exists. The QR is still issued — the operator may be about
  // to fix their setup, and a code they can read beats a blank card — but the
  // UI is told it will not work so it can say why.
  return { origin: browserOrigin, reachable: false };
}
