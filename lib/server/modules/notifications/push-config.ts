import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { settings } from "@/lib/server/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/server/modules/files/secrets";

/** ntfy's own public instance, used when an operator names a topic and nothing else. */
export const DEFAULT_NTFY_URL = "https://ntfy.sh";

export type PushConfig = {
  enabled: boolean;
  ntfyUrl: string;
  ntfyTopic: string | null;
  /** Only set for protected topics; ntfy.sh public topics need none. */
  ntfyToken: string | null;
};

/** What the UI is allowed to see: whether a token exists, never the token. */
export type PushConfigPublic = {
  enabled: boolean;
  ntfyUrl: string;
  ntfyTopic: string | null;
  hasToken: boolean;
};

export function toPublicPushConfig(config: PushConfig): PushConfigPublic {
  return {
    enabled: config.enabled,
    ntfyUrl: config.ntfyUrl,
    ntfyTopic: config.ntfyTopic,
    hasToken: config.ntfyToken !== null,
  };
}

export async function readPushConfig(): Promise<PushConfig> {
  const [row] = await db.select().from(settings).where(eq(settings.id, "singleton")).limit(1);

  if (!row) {
    return { enabled: false, ntfyUrl: DEFAULT_NTFY_URL, ntfyTopic: null, ntfyToken: null };
  }

  let ntfyToken: string | null = null;
  if (row.pushNtfyTokenCiphertext && row.pushNtfyTokenIv && row.pushNtfyTokenTag) {
    try {
      ntfyToken = decryptSecret({
        ciphertext: row.pushNtfyTokenCiphertext,
        iv: row.pushNtfyTokenIv,
        tag: row.pushNtfyTokenTag,
      });
    } catch {
      // A token that will not decrypt — a rotated key, a restored backup — is
      // treated as absent. Publishing without it fails loudly at ntfy; throwing
      // here would take the notification down with it.
      ntfyToken = null;
    }
  }

  return {
    enabled: row.pushEnabled,
    ntfyUrl: row.pushNtfyUrl ?? DEFAULT_NTFY_URL,
    ntfyTopic: row.pushNtfyTopic,
    ntfyToken,
  };
}

export async function writePushConfig(update: {
  enabled: boolean;
  ntfyUrl: string;
  ntfyTopic: string | null;
  /** undefined leaves the stored token alone; null clears it. */
  ntfyToken?: string | null;
}): Promise<void> {
  const secret =
    update.ntfyToken === undefined
      ? {}
      : update.ntfyToken === null
        ? {
            pushNtfyTokenCiphertext: null,
            pushNtfyTokenIv: null,
            pushNtfyTokenTag: null,
          }
        : (() => {
            const encrypted = encryptSecret(update.ntfyToken);
            return {
              pushNtfyTokenCiphertext: encrypted.ciphertext,
              pushNtfyTokenIv: encrypted.iv,
              pushNtfyTokenTag: encrypted.tag,
            };
          })();

  await db
    .update(settings)
    .set({
      pushEnabled: update.enabled,
      pushNtfyUrl: update.ntfyUrl,
      pushNtfyTopic: update.ntfyTopic,
      ...secret,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, "singleton"));
}
