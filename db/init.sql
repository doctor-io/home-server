CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS apps_name_idx ON apps (name);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS app_stacks (
  app_id TEXT PRIMARY KEY,
  template_name TEXT NOT NULL,
  stack_name TEXT NOT NULL,
  compose_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_installed',
  web_ui_port INTEGER,
  env_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_name TEXT,
  icon_url TEXT,
  installed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_stacks_status_idx ON app_stacks (status);
CREATE INDEX IF NOT EXISTS app_stacks_web_ui_port_idx ON app_stacks (web_ui_port);

CREATE TABLE IF NOT EXISTS app_operations (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  current_step TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_operations_app_id_idx ON app_operations (app_id);
CREATE INDEX IF NOT EXISTS app_operations_status_idx ON app_operations (status);
CREATE INDEX IF NOT EXISTS app_operations_updated_at_idx ON app_operations (updated_at DESC);

CREATE TABLE IF NOT EXISTS custom_store_apps (
  app_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon_url TEXT,
  web_ui_url TEXT,
  source_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  compose_content TEXT NOT NULL,
  repository_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custom_store_apps_updated_at_idx ON custom_store_apps (updated_at DESC);

-- Migrations for existing installations
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'app_stacks') THEN
    ALTER TABLE app_stacks ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE app_stacks ADD COLUMN IF NOT EXISTS icon_url TEXT;
  END IF;
END $$;
