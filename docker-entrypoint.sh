#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/.bin/drizzle-kit push --config drizzle.config.ts

# Default V8 heap cap is generous for amd64 (1.5 GB) but exceeds the
# total RAM of a Pi 3 (1 GB). Apply a Pi-friendly default unless the
# operator overrides via NODE_OPTIONS.
if [ -z "${NODE_OPTIONS:-}" ]; then
  NODE_OPTIONS="--max-old-space-size=768"
fi
export NODE_OPTIONS

echo "Starting Homeio with NODE_OPTIONS=${NODE_OPTIONS}..."
exec node server.js
