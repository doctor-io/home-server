ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "onboarding_state" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "onboarding_step" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "timezone" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "default_storage_root" text;
