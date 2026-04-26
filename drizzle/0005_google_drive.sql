CREATE TABLE IF NOT EXISTS "files_google_drive_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "display_name" text,
  "access_token_ciphertext" text NOT NULL,
  "access_token_iv" text NOT NULL,
  "access_token_tag" text NOT NULL,
  "refresh_token_ciphertext" text,
  "refresh_token_iv" text,
  "refresh_token_tag" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "files_google_drive_tokens_email_idx" ON "files_google_drive_tokens" ("email");
CREATE INDEX IF NOT EXISTS "files_google_drive_tokens_created_at_idx" ON "files_google_drive_tokens" ("created_at");
