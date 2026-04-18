CREATE TABLE "instance_config" (
  "id" text PRIMARY KEY DEFAULT 'singleton',
  "instance_id" text NOT NULL,
  "telemetry_enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
