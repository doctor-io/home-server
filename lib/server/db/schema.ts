import "server-only";

import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const apps = pgTable(
  "apps",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    status: text("status").notNull().default("unknown"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("apps_name_idx").on(table.name)],
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("users_username_idx").on(table.username)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const appStacks = pgTable(
  "app_stacks",
  {
    appId: text("app_id").primaryKey(),
    templateName: text("template_name").notNull(),
    stackName: text("stack_name").notNull(),
    composePath: text("compose_path").notNull(),
    status: text("status").notNull().default("not_installed"),
    webUiPort: integer("web_ui_port"),
    envJson: jsonb("env_json").notNull().default({}),
    displayName: text("display_name"),
    iconUrl: text("icon_url"),
    installedAt: timestamp("installed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    isUpToDate: boolean("is_up_to_date").default(true),
    lastUpdateCheck: timestamp("last_update_check", { withTimezone: true }),
    localDigest: text("local_digest"),
    remoteDigest: text("remote_digest"),
  },
  (table) => [
    index("app_stacks_status_idx").on(table.status),
    index("app_stacks_web_ui_port_idx").on(table.webUiPort),
  ],
);

export const appOperations = pgTable(
  "app_operations",
  {
    id: text("id").primaryKey(),
    appId: text("app_id").notNull(),
    action: text("action").notNull(),
    status: text("status").notNull(),
    progressPercent: integer("progress_percent").notNull().default(0),
    currentStep: text("current_step").notNull().default("queued"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("app_operations_app_id_idx").on(table.appId),
    index("app_operations_status_idx").on(table.status),
    index("app_operations_updated_at_idx").on(table.updatedAt.desc()),
  ],
);

export const customStoreApps = pgTable(
  "custom_store_apps",
  {
    appId: text("app_id").primaryKey(),
    name: text("name").notNull(),
    iconUrl: text("icon_url"),
    webUiUrl: text("web_ui_url"),
    sourceType: text("source_type").notNull(),
    sourceText: text("source_text").notNull(),
    composeContent: text("compose_content").notNull(),
    repositoryUrl: text("repository_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("custom_store_apps_updated_at_idx").on(table.updatedAt.desc())],
);
