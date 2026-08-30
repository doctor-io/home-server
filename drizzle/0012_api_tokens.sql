CREATE TABLE IF NOT EXISTS "api_tokens" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "token_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "expires_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "last_used_ip" text,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "api_tokens_prefix_idx" ON "api_tokens" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "api_tokens_created_at_idx" ON "api_tokens" USING btree ("created_at" DESC);
