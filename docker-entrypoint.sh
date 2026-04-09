#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/.bin/drizzle-kit push --config drizzle.config.ts

echo "Starting Homeio..."
exec node server.js
