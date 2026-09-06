import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { pairingCodes } from "@/lib/server/db/schema";
import { createSession } from "@/lib/server/modules/auth/repository";
import { createSessionToken } from "@/lib/server/modules/auth/session-token";
import { serverEnv } from "@/lib/server/env";

/**
 * A minute. The QR is on a screen in a room, and the phone is already in the
 * hand that is looking at it — anything longer is only more time for the screen
 * to be photographed, shoulder-surfed, or left unattended.
 */
/**
 * Two minutes, not one.
 *
 * The QR is a credential while it is on screen, so this is kept short — but the
 * real path is: open the app, tap Scan, grant the camera permission the first
 * time, aim, wait for a reachability probe, then load the claim page. A minute
 * ran out during the permission prompt, and a first pairing that fails for no
 * visible reason is the worst possible introduction. Against someone in the room
 * photographing the screen, sixty more seconds change nothing.
 */
export const PAIRING_CODE_TTL_MS = 120_000;

export class PairingError extends Error {
  constructor(
    readonly code: "invalid_code" | "expired" | "already_claimed",
    message: string,
  ) {
    super(message);
    this.name = "PairingError";
  }
}

/**
 * Deterministic, unlike the scrypt used for API tokens. A pairing code is 256
 * bits of randomness that dies in a minute, so there is nothing to brute-force
 * and no reason to pay a slow hash on the claim path — but a database snapshot
 * still must not contain a working code.
 */
function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generatePairingCode() {
  return randomBytes(32).toString("base64url");
}

/**
 * Mint a code for a signed-in operator, and drop any earlier unclaimed ones so
 * that exactly one QR is live at a time. Two valid codes means a stale phone
 * screen somewhere still opens the server.
 */
export async function createPairingCode(userId: string) {
  await db
    .delete(pairingCodes)
    .where(and(eq(pairingCodes.userId, userId), isNull(pairingCodes.claimedAt)));

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);

  await db.insert(pairingCodes).values({
    id: randomUUID(),
    codeHash: hashCode(code),
    userId,
    expiresAt,
  });

  return { code, expiresAt };
}

/**
 * Spend a code and return a session for the operator who minted it.
 *
 * The claim is a conditional UPDATE rather than a read followed by a write:
 * two phones scanning the same screen at the same moment must not both come
 * away with a session, and only the database can settle that race. A row comes
 * back exactly once — the second attempt matches nothing and is refused.
 */
export async function claimPairingCode(code: string, clientIp: string | null) {
  const now = new Date();

  const [claimed] = await db
    .update(pairingCodes)
    .set({ claimedAt: now, claimedIp: clientIp })
    .where(
      and(
        eq(pairingCodes.codeHash, hashCode(code)),
        isNull(pairingCodes.claimedAt),
        gt(pairingCodes.expiresAt, now),
      ),
    )
    .returning();

  if (!claimed) {
    // Deliberately one message for every failure. "Expired" and "already used"
    // and "never existed" are the same answer to anyone holding a code they
    // were not given.
    throw new PairingError("invalid_code", "This pairing code is not valid");
  }

  // The same session length a password login gets: pairing is a different way
  // in, not a different kind of session.
  const expiresAt = new Date(Date.now() + serverEnv.AUTH_SESSION_HOURS * 60 * 60 * 1000);
  const sessionId = randomUUID();

  await createSession({ id: sessionId, userId: claimed.userId, expiresAt });

  return {
    token: createSessionToken(sessionId, Math.floor(expiresAt.getTime() / 1000)),
    expiresAt,
    userId: claimed.userId,
  };
}

/**
 * Housekeeping for rows nobody will ever claim. Cheap enough to run on the mint
 * path, which is the only moment this table is written by a person.
 */
export async function purgeStalePairingCodes() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db
    .delete(pairingCodes)
    .where(or(lt(pairingCodes.expiresAt, cutoff), lt(pairingCodes.createdAt, cutoff)));
}
