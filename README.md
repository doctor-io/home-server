# Home Server

Home Server is a self-hosted server manager with a desktop-style UI.
It is designed as an alternative to other home server managers, focused on a modern interface, realtime system visibility, and app lifecycle operations.

## Features

- Desktop-like shell UI with dock, windows, widgets, and lock screen.
- Realtime system metrics via SSE and WebSocket APIs.
- App Store flow with install, uninstall, and redeploy operations.
- Auth bootstrap flow: first-run register, then login/session-based access.
- PostgreSQL-backed persistence for users, sessions, and installed apps.
- Structured server/client logging with optional file sink.
- One-command install/update/uninstall scripts for server deployments.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/home-server/main/scripts/install.sh | sudo bash
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

4. Initialize schema and seed first app user:

```bash
AUTH_PRIMARY_PASSWORD='change-me-strong' npm run db:init
```

5. Start development server:

```bash
npm run dev
```

6. Open:

```text
http://localhost:3000
```

On first run with no users, the app routes to `/register`.
After at least one user exists, it routes to `/login`.

## Useful Commands

```bash
npm run test
npm run lint
npm run build
npm run start
```
