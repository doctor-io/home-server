CREATE TABLE IF NOT EXISTS "pairing_codes" (
  "id" text PRIMARY KEY NOT NULL,
  -- SHA-256 of the code. A code lives 60 seconds, but a database snapshot
  -- should still never hand anyone a working one.
  "code_hash" text NOT NULL,
  "user_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "claimed_at" timestamp with time zone,
  "claimed_ip" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pairing_codes_code_hash_idx" ON "pairing_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pairing_codes_user_id_idx" ON "pairing_codes" USING btree ("user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pairing_codes" ADD CONSTRAINT "pairing_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
