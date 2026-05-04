import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { settings } from "@/lib/server/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/server/modules/files/secrets";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleOAuthConfigPublic = {
  clientId: string;
  redirectUri: string;
  hasSecret: boolean;
};

async function ensureSettingsRow() {
  await db.execute(sql`
    INSERT INTO settings (id, appearance_json, updated_at)
    VALUES ('singleton', '{}', NOW())
    ON CONFLICT (id) DO NOTHING
  `);
}

export async function getGoogleOAuthConfig(): Promise<GoogleOAuthConfig | null> {
  await ensureSettingsRow();

  const rows = await db
    .select({
      googleClientId: settings.googleClientId,
      googleClientSecretCiphertext: settings.googleClientSecretCiphertext,
      googleClientSecretIv: settings.googleClientSecretIv,
      googleClientSecretTag: settings.googleClientSecretTag,
      googleRedirectUri: settings.googleRedirectUri,
    })
    .from(settings)
    .where(eq(settings.id, "singleton"))
    .limit(1);

  const row = rows[0];
  if (!row?.googleClientId || !row.googleClientSecretCiphertext || !row.googleClientSecretIv || !row.googleClientSecretTag) {
    return null;
  }

  const clientSecret = decryptSecret({
    ciphertext: row.googleClientSecretCiphertext,
    iv: row.googleClientSecretIv,
    tag: row.googleClientSecretTag,
  });

  return {
    clientId: row.googleClientId,
    clientSecret,
    redirectUri: row.googleRedirectUri ?? "http://localhost:3000/api/v1/files/google-drive/callback",
  };
}

export async function getGoogleOAuthConfigPublic(): Promise<GoogleOAuthConfigPublic> {
  await ensureSettingsRow();

  const rows = await db
    .select({
      googleClientId: settings.googleClientId,
      googleClientSecretCiphertext: settings.googleClientSecretCiphertext,
      googleRedirectUri: settings.googleRedirectUri,
    })
    .from(settings)
    .where(eq(settings.id, "singleton"))
    .limit(1);

  const row = rows[0];
  return {
    clientId: row?.googleClientId ?? "",
    redirectUri: row?.googleRedirectUri ?? "http://localhost:3000/api/v1/files/google-drive/callback",
    hasSecret: Boolean(row?.googleClientSecretCiphertext),
  };
}

export async function saveGoogleOAuthConfig(config: GoogleOAuthConfig): Promise<void> {
  await ensureSettingsRow();

  const encSecret = encryptSecret(config.clientSecret);

  await db
    .update(settings)
    .set({
      googleClientId: config.clientId,
      googleClientSecretCiphertext: encSecret.ciphertext,
      googleClientSecretIv: encSecret.iv,
      googleClientSecretTag: encSecret.tag,
      googleRedirectUri: config.redirectUri,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, "singleton"));
}

export async function clearGoogleOAuthConfig(): Promise<void> {
  await ensureSettingsRow();

  await db
    .update(settings)
    .set({
      googleClientId: null,
      googleClientSecretCiphertext: null,
      googleClientSecretIv: null,
      googleClientSecretTag: null,
      googleRedirectUri: null,
      updatedAt: new Date(),
    })
    .where(eq(settings.id, "singleton"));
}
