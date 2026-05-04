ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tailscale_tailnet" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tailscale_api_key_ciphertext" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tailscale_api_key_iv" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tailscale_api_key_tag" text;
