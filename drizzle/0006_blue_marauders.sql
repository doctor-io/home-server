ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "google_client_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "google_client_secret_ciphertext" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "google_client_secret_iv" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "google_client_secret_tag" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "google_redirect_uri" text;
