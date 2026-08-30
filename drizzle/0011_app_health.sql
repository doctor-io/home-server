CREATE TABLE IF NOT EXISTS "app_health" (
  "app_id" text PRIMARY KEY NOT NULL,
  "restart_policy" text DEFAULT 'no' NOT NULL,
  "max_restarts" integer DEFAULT 5 NOT NULL,
  "window_minutes" integer DEFAULT 10 NOT NULL,
  "state" text DEFAULT 'unknown' NOT NULL,
  "restart_count" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone,
  "last_transition_at" timestamp with time zone,
  "muted_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_health_state_idx" ON "app_health" USING btree ("state");
