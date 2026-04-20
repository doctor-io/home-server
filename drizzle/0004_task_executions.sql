CREATE TABLE IF NOT EXISTS "scheduled_task_executions" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "output" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "duration_ms" integer
);

CREATE INDEX IF NOT EXISTS "scheduled_task_executions_task_id_idx" ON "scheduled_task_executions" ("task_id");
CREATE INDEX IF NOT EXISTS "scheduled_task_executions_started_at_idx" ON "scheduled_task_executions" ("started_at" DESC);
