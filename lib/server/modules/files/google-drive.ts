import "server-only";

import { randomBytes } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/server/db/drizzle";
import { filesGoogleDriveTokens } from "@/lib/server/db/schema";
import { encryptSecret, decryptSecret } from "@/lib/server/modules/files/secrets";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

export type GoogleDriveConnection = {
  id: string;
  email: string;
  displayName: string | null;
  connectedAt: string;
};

export class GoogleDriveError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message);
    this.name = "GoogleDriveError";
  }
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI ?? "http://localhost:3000/api/v1/files/google-drive/callback";

  if (!clientId || !clientSecret) {
    throw new GoogleDriveError(
      "Google Drive is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.",
      "not_configured",
      501,
    );
  }

  return { clientId, clientSecret, redirectUri };
}

async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS files_google_drive_tokens (
      id text PRIMARY KEY,
      email text NOT NULL,
      display_name text,
      access_token_ciphertext text NOT NULL,
      access_token_iv text NOT NULL,
      access_token_tag text NOT NULL,
      refresh_token_ciphertext text,
      refresh_token_iv text,
      refresh_token_tag text,
      expires_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS files_google_drive_tokens_email_idx
    ON files_google_drive_tokens (email)
  `);
}

let ensureTablePromise: Promise<void> | null = null;

async function ensureTableOnce() {
  if (!ensureTablePromise) {
    ensureTablePromise = ensureTable().catch((err) => {
      ensureTablePromise = null;
      throw err;
    });
  }
  await ensureTablePromise;
}

export function isGoogleDriveConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = getOAuthConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function generateState(): string {
  return randomBytes(16).toString("hex");
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

type UserInfo = {
  email: string;
  name?: string;
};

async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = getOAuthConfig();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new GoogleDriveError(
      `Token exchange failed: ${body.error ?? response.statusText}`,
      "token_exchange_failed",
    );
  }

  return response.json() as Promise<TokenResponse>;
}

async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new GoogleDriveError("Failed to fetch Google user info", "userinfo_failed");
  }

  return response.json() as Promise<UserInfo>;
}

export async function handleOAuthCallback(code: string): Promise<GoogleDriveConnection> {
  await ensureTableOnce();

  const tokens = await exchangeCodeForTokens(code);
  const userInfo = await fetchUserInfo(tokens.access_token);

  const encAccessToken = encryptSecret(tokens.access_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const id = randomBytes(8).toString("hex");
  const email = userInfo.email;

  const encRefresh = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : null;

  await db
    .insert(filesGoogleDriveTokens)
    .values({
      id,
      email,
      displayName: userInfo.name ?? null,
      accessTokenCiphertext: encAccessToken.ciphertext,
      accessTokenIv: encAccessToken.iv,
      accessTokenTag: encAccessToken.tag,
      refreshTokenCiphertext: encRefresh?.ciphertext ?? null,
      refreshTokenIv: encRefresh?.iv ?? null,
      refreshTokenTag: encRefresh?.tag ?? null,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: filesGoogleDriveTokens.email,
      set: {
        displayName: userInfo.name ?? null,
        accessTokenCiphertext: encAccessToken.ciphertext,
        accessTokenIv: encAccessToken.iv,
        accessTokenTag: encAccessToken.tag,
        refreshTokenCiphertext: encRefresh?.ciphertext ?? null,
        refreshTokenIv: encRefresh?.iv ?? null,
        refreshTokenTag: encRefresh?.tag ?? null,
        expiresAt,
        updatedAt: new Date(),
      },
    });

  const row = await db
    .select()
    .from(filesGoogleDriveTokens)
    .where(eq(filesGoogleDriveTokens.email, email))
    .limit(1);

  if (!row[0]) throw new GoogleDriveError("Failed to save Google Drive connection", "save_failed");

  return {
    id: row[0].id,
    email: row[0].email,
    displayName: row[0].displayName,
    connectedAt: row[0].createdAt.toISOString(),
  };
}

export async function listGoogleDriveConnections(): Promise<GoogleDriveConnection[]> {
  await ensureTableOnce();

  const rows = await db
    .select({
      id: filesGoogleDriveTokens.id,
      email: filesGoogleDriveTokens.email,
      displayName: filesGoogleDriveTokens.displayName,
      createdAt: filesGoogleDriveTokens.createdAt,
    })
    .from(filesGoogleDriveTokens)
    .orderBy(asc(filesGoogleDriveTokens.createdAt));

  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    connectedAt: r.createdAt.toISOString(),
  }));
}

export async function removeGoogleDriveConnection(id: string): Promise<void> {
  await ensureTableOnce();

  await db.delete(filesGoogleDriveTokens).where(eq(filesGoogleDriveTokens.id, id));
}

export async function getAccessToken(connectionId: string): Promise<string> {
  await ensureTableOnce();

  const rows = await db
    .select()
    .from(filesGoogleDriveTokens)
    .where(eq(filesGoogleDriveTokens.id, connectionId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new GoogleDriveError("Connection not found", "not_found", 404);

  const now = new Date();
  if (row.expiresAt && row.expiresAt > now) {
    return decryptSecret({
      ciphertext: row.accessTokenCiphertext,
      iv: row.accessTokenIv,
      tag: row.accessTokenTag,
    });
  }

  if (!row.refreshTokenCiphertext || !row.refreshTokenIv || !row.refreshTokenTag) {
    throw new GoogleDriveError("Access token expired and no refresh token available", "token_expired", 401);
  }

  const refreshToken = decryptSecret({
    ciphertext: row.refreshTokenCiphertext,
    iv: row.refreshTokenIv,
    tag: row.refreshTokenTag,
  });

  const { clientId, clientSecret } = getOAuthConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!response.ok) {
    throw new GoogleDriveError("Failed to refresh access token", "refresh_failed", 401);
  }

  const tokens = (await response.json()) as TokenResponse;
  const encNew = encryptSecret(tokens.access_token);
  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await db
    .update(filesGoogleDriveTokens)
    .set({
      accessTokenCiphertext: encNew.ciphertext,
      accessTokenIv: encNew.iv,
      accessTokenTag: encNew.tag,
      expiresAt: newExpiry,
      updatedAt: new Date(),
    })
    .where(eq(filesGoogleDriveTokens.id, connectionId));

  return tokens.access_token;
}
