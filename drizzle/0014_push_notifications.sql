-- Push delivery config for the notification dispatcher. Additive and nullable:
-- an install that upgrades and changes nothing has push_enabled false and keeps
-- exactly the notifications it had.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "push_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "push_ntfy_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "push_ntfy_topic" text;--> statement-breakpoint
-- Optional: ntfy only needs a token for protected topics, and it is a
-- credential, so it is encrypted like the Tailscale key beside it.
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "push_ntfy_token_ciphertext" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "push_ntfy_token_iv" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "push_ntfy_token_tag" text;
