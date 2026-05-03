import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { settings } from "@/lib/server/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/server/modules/files/secrets";
import type { TailscaleConfigPublic } from "@/lib/shared/contracts/tailscale";

export type TailscaleConfig = {
  tailnet: string;
  apiKey: string;
};

async function ensureSettingsRow() {
  await db.execute(sql`
    INSERT INTO settings (id, appearance_json, updated_at)
    VALUES ('singleton', '{}', NOW())
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function getTailscaleConfig(): Promise<TailscaleConfig | null> {
  await ensureSettingsRow();

  const rows = await db
    .select({
      tailnet: settings.tailscaleTailnet,
      apiKeyCiphertext: settings.tailscaleApiKeyCiphertext,
      apiKeyIv: settings.tailscaleApiKeyIv,
      apiKeyTag: settings.tailscaleApiKeyTag,
    })
    .from(settings)
    .where(eq(settings.id, "singleton"))
    .limit(1);

  const row = rows[0];
  if (!row?.tailnet || !row.apiKeyCiphertext || !row.apiKeyIv || !row.apiKeyTag) {
    return null;
  }

  return {
    tailnet: row.tailnet,
    apiKey: decryptSecret({
      ciphertext: row.apiKeyCiphertext,
      iv: row.apiKeyIv,
      tag: row.apiKeyTag,
    }),
  };
}

export async function getTailscaleConfigPublic(): Promise<TailscaleConfigPublic> {
  await ensureSettingsRow();

  const rows = await db
    .select({
      tailnet: settings.tailscaleTailnet,
      apiKeyCiphertext: settings.tailscaleApiKeyCiphertext,
    })
    .from(settings)
    .where(eq(settings.id, "singleton"))
    .limit(1);

  const row = rows[0];
  return {
    tailnet: row?.tailnet ?? "",
    hasApiKey: Boolean(row?.apiKeyCiphertext),
  };
}

export async function saveTailscaleConfig(config: TailscaleConfig): Promise<void> {
  await ensureSettingsRow();

  const encryptedApiKey = encryptSecret(config.apiKey);

  await db
    .update(settings)
    .set({
      tailscaleTailnet: config.tailnet,
      tailscaleApiKeyCiphertext: encryptedApiKey.ciphertext,
      tailscaleApiKeyIv: encryptedApiKey.iv,
      tailscaleApiKeyTag: encryptedApiKey.tag,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, "singleton"));
}

export async function clearTailscaleConfig(): Promise<void> {
  await ensureSettingsRow();

  await db
    .update(settings)
    .set({
      tailscaleTailnet: null,
      tailscaleApiKeyCiphertext: null,
      tailscaleApiKeyIv: null,
      tailscaleApiKeyTag: null,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, "singleton"));
}
