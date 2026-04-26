CREATE TABLE IF NOT EXISTS "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"appearance_json" jsonb NOT NULL DEFAULT '{}',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
