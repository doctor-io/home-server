# Homeio

Homeio is a self-hosted server manager with a desktop-style UI.
It is designed as an alternative to other home server managers (CasaOS, Umbrel, Portainer), focused on a modern interface, realtime system visibility, and app lifecycle operations.

## Screenshots

| Desktop | App Store |
|---------|-----------|
| ![Desktop](public/screenshots/home.png) | ![App Store](public/screenshots/app-store.png) |

| Settings | Terminal |
|----------|----------|
| ![Settings](public/screenshots/settings.png) | ![Terminal](public/screenshots/terminal.png) |

## Features

- Desktop-like shell UI with dock, windows, widgets, and lock screen.
- Realtime system metrics (CPU, memory, disk, network) streamed via SSE.
- App Store: install, update, uninstall, and redeploy Docker Compose apps. Compatible with CasaOS-style app store archives — any store listed on [awesome.casaos.io](https://awesome.casaos.io/content/3rd-party-app-stores/list.html) works out of the box.
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
curl -fsSL https://raw.githubusercontent.com/doctor-io/homeio/main/scripts/install.sh | sudo bash
```

**Note:** The installer automatically changes to `/tmp` to avoid directory errors. You can run it from anywhere.

Installer defaults:
- `HOMEIO_VERBOSE=false`: keeps installer output concise.
- Cookie security is detected automatically — `Secure` flag is set when the request arrives over HTTPS (via `x-forwarded-proto`), no manual configuration needed.

Common install variants:

```bash
# Verbose installer logs
curl -fsSL https://raw.githubusercontent.com/doctor-io/homeio/main/scripts/install.sh | sudo HOMEIO_VERBOSE=true bash

# Custom port
curl -fsSL https://raw.githubusercontent.com/doctor-io/homeio/main/scripts/install.sh | sudo HOMEIO_PUBLIC_PORT=8080 bash
```

## Update

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/homeio/main/scripts/update.sh | sudo bash
```

Update from a release tarball:

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/homeio/main/scripts/update.sh | sudo HOMEIO_RELEASE_TARBALL_URL="https://example.com/home-server-release.tar.gz" bash
```

## Uninstall

Uninstall app files only (keep DB/data/env):

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/homeio/main/scripts/uninstall.sh | sudo bash
```

Full purge (remove DB, data, env):

```bash
curl -fsSL https://raw.githubusercontent.com/doctor-io/homeio/main/scripts/uninstall.sh | sudo bash -s -- --purge --yes
```

## Experimental Features

The following features are available but have not been fully tested across all environments. Use with care and always keep a backup.

- **Shutdown** — Initiates a clean OS shutdown from the UI. The server goes offline; you must physically power it back on.
- **Factory reset** — Wipes all Homeio data and returns the server to a blank state. **Irreversible.** Manual recovery is required if the reset fails mid-way.
- **Self-update rollback** — If a self-update fails, the previous version is restored automatically. The rollback path has not been tested under all failure scenarios. Keep a manual backup before updating.

## Limitations

- **Single user**: Homeio supports one user account per installation. Multi-user support is not currently available. After the initial setup (first `/register`), registration is automatically disabled.
- **Linux only**: The installer targets Debian/Ubuntu/Raspberry Pi OS with `apt`. macOS and Windows are not supported for production deployments (development works on macOS).
- **App Store hardware compatibility**: Some app templates in the catalog are designed for specific hardware (e.g. Raspberry Pi GPU). Installing those apps on incompatible hardware will show a clear error message. Not a Homeio bug — edit the compose file to remove the hardware device requirement if it is optional.
- **Network manager**: WiFi and Ethernet management require NetworkManager with D-Bus. Not available in all environments.

## Security Notes

- **Always change `AUTH_SESSION_SECRET`** to a long random string (32+ chars) before exposing the server outside your LAN.
- **HTTPS**: Cookie `Secure` flag is set automatically when requests arrive over HTTPS — no config needed. Just put Homeio behind a TLS reverse proxy and it works.
- **Firewall**: Homeio is designed for use on a trusted LAN. If you expose it to the internet, put it behind a reverse proxy with TLS and authentication.
- The built-in terminal runs commands through a strict allowlist (ls, cat, docker, df, etc.). Shell access is not provided.

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

## License

MIT — see [LICENSE](./LICENSE).
