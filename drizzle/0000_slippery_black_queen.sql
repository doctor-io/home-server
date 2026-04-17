CREATE TABLE "app_operations" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"current_step" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_stacks" (
	"app_id" text PRIMARY KEY NOT NULL,
	"template_name" text NOT NULL,
	"stack_name" text NOT NULL,
	"compose_path" text NOT NULL,
	"status" text DEFAULT 'not_installed' NOT NULL,
	"web_ui_port" integer,
	"env_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_name" text,
	"icon_url" text,
	"installed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_up_to_date" boolean DEFAULT true,
	"last_update_check" timestamp with time zone,
	"local_digest" text,
	"remote_digest" text
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_store_apps" (
	"app_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon_url" text,
	"web_ui_url" text,
	"source_type" text NOT NULL,
	"source_text" text NOT NULL,
	"compose_content" text NOT NULL,
	"repository_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files_local_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"share_name" text NOT NULL,
	"source_path" text NOT NULL,
	"shared_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files_network_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"host" text NOT NULL,
	"share" text NOT NULL,
	"username" text NOT NULL,
	"password_ciphertext" text NOT NULL,
	"password_iv" text NOT NULL,
	"password_tag" text NOT NULL,
	"mount_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files_trash_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"trash_path" text NOT NULL,
	"original_path" text NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_operations_app_id_idx" ON "app_operations" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_operations_status_idx" ON "app_operations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "app_operations_updated_at_idx" ON "app_operations" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "app_stacks_status_idx" ON "app_stacks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "app_stacks_web_ui_port_idx" ON "app_stacks" USING btree ("web_ui_port");--> statement-breakpoint
CREATE INDEX "apps_name_idx" ON "apps" USING btree ("name");--> statement-breakpoint
CREATE INDEX "custom_store_apps_updated_at_idx" ON "custom_store_apps" USING btree ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "files_local_shares_share_name_idx" ON "files_local_shares" USING btree ("share_name");--> statement-breakpoint
CREATE UNIQUE INDEX "files_local_shares_source_path_idx" ON "files_local_shares" USING btree ("source_path");--> statement-breakpoint
CREATE UNIQUE INDEX "files_local_shares_shared_path_idx" ON "files_local_shares" USING btree ("shared_path");--> statement-breakpoint
CREATE INDEX "files_local_shares_created_at_idx" ON "files_local_shares" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "files_network_shares_mount_path_idx" ON "files_network_shares" USING btree ("mount_path");--> statement-breakpoint
CREATE INDEX "files_network_shares_created_at_idx" ON "files_network_shares" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "files_trash_entries_trash_path_idx" ON "files_trash_entries" USING btree ("trash_path");--> statement-breakpoint
CREATE INDEX "files_trash_entries_deleted_at_idx" ON "files_trash_entries" USING btree ("deleted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");