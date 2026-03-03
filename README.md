# Home Server

Home Server is a self-hosted server manager with a desktop-style UI.
It is designed as an alternative to other home server managers, focused on a modern interface, realtime system visibility, and app lifecycle operations.

## Features

- Desktop-like shell UI with dock, windows, widgets, and lock screen.
- Realtime system metrics (CPU, memory, disk, network) streamed via SSE.
- App Store: install, update, uninstall, and redeploy Docker Compose apps.
- File manager: browse, upload, download, rename, copy/move, trash, starred paths.
- Local folder sharing over the network (Samba/usershare).
- Network storage: mount/unmount SMB shares.
- Terminal: interactive shell sessions over WebSocket.
- Docker container stats streamed in real time.
- Network manager: WiFi and Ethernet via NetworkManager D-Bus.
- Weather widget with location-based current conditions.
- Auth bootstrap flow: first-run register, then login/session-based access.
- PostgreSQL-backed persistence for users, sessions, installed apps, and file state.
- Structured server/client logging with optional file sink.
- One-command install/update/uninstall scripts for server deployments.
- Production networking: app listens on `127.0.0.1:12026`, exposed on `:80` via Nginx.

## Install

**Quick install (one command):**

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/install.sh | sudo bash
```

**Note:** The installer automatically changes to `/tmp` to avoid directory errors. You can run it from anywhere.

Installer defaults:
- `HOMEIO_SEED_PRINCIPAL=false`: does not create a principal user; first access goes to `/register`.
- `HOMEIO_VERBOSE=false`: keeps installer output concise.
- `AUTH_COOKIE_SECURE=false`: keeps auth cookie compatible with `http://` installs.

Cookie security:
- HTTP deployment: `AUTH_COOKIE_SECURE=false`
- HTTPS deployment: set `AUTH_COOKIE_SECURE=true`

Common install variants:

```bash
# Verbose installer logs
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/install.sh | sudo HOMEIO_VERBOSE=true bash

# Custom port
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/install.sh | sudo HOMEIO_PUBLIC_PORT=8080 bash
```

## Update

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/update.sh | sudo bash
```

Update from a release tarball:

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/update.sh | sudo HOMEIO_RELEASE_TARBALL_URL="https://example.com/home-server-release.tar.gz" bash
```

## Uninstall

Uninstall app files only (keep DB/data/env):

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/uninstall.sh | sudo bash
```

Full purge (remove DB, data, env):

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/uninstall.sh | sudo bash -s -- --purge --yes
```

## Development Mode

### Prerequisites

- Node.js 22.x
- npm
- PostgreSQL running locally

### Run locally

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env.local
```

3. Ensure database exists (default from `.env.example` is `home_server`):

```bash
createdb home_server
```

4. Initialize database schema:

```bash
npm run db:init
```

5. Start development server:

```bash
npm run dev
```

6. Open:

```text
http://localhost:3000
```

With no users in database, the app routes to `/register`.
With at least one user, it routes to `/login`.

## Useful Commands

```bash
npm run test          # Run all tests once
npm run test:watch    # Vitest in watch mode
npm run lint          # ESLint
npm run build         # Production build
npm run db:migrate    # Run SQL migrations
npm run db:reset      # Full database reset (destructive)
```
