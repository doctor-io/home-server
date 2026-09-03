# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.7.24] - 2026-07-02

### Added

#### Mobile App (preview)

- `apps/mobile` — a [Capacitor](https://capacitorjs.com/) shell for Android and iOS that connects to a Homeio server over Tailscale (moved to [doctor-io/homeio-mobile](https://github.com/doctor-io/homeio-mobile) after this release)
- The bundled Connect screen probes `GET <address>/api/health`, then navigates the WebView onto the server's own origin — login, terminal WebSocket, SSE, and uploads all run first-party, so nothing is re-implemented and no CORS or auth bridging is involved
- Requires the official Tailscale app on the phone; Homeio does not embed the tunnel and never stores your password
- Native platform folders are generated locally and git-ignored — see the app's own repository

#### Documentation

- Demo GIF in the README showing the desktop shell, command palette, file manager, and terminal
- Live demo link ([demo.homeio.app](https://demo.homeio.app))

### Changed

- `apps/` is excluded from ESLint and TypeScript compilation — the mobile app builds independently of the server workspace

---

## [1.7.23] - 2026-06-02

### Added

#### Two-Factor Authentication (TOTP)

- Enrol any authenticator app (Google Authenticator, Authy, 1Password, Bitwarden) from **Settings → Users & Access** — QR code plus manual key, confirmed with a 6-digit code
- Ten single-use backup codes revealed once at enrolment, with copy/download and an acknowledgement step
- Login becomes two steps once 2FA is on: a correct password issues a short-lived (5 min) stateless partial-auth token instead of a session, and the TOTP code exchanges it for the real session cookie
- "Use backup code instead" toggle on the login TOTP step
- Disable 2FA with a current TOTP code or a backup code; disabling revokes every session for the user, so a captured cookie cannot ride the change
- RFC 4226 / 6238 implementation on Node's `crypto` — 160-bit base32 secrets, constant-time comparison, configurable drift window, verified against the RFC reference vectors
- Secrets encrypted at rest with AES-256-GCM; the key comes from `AUTH_TOTP_ENCRYPTION_KEY` or is derived from `AUTH_SESSION_SECRET` via HKDF-SHA256
- New endpoints: `POST /api/v1/auth/2fa/setup`, `/2fa/verify`, `/2fa/disable`, and `/api/v1/auth/login/totp`; `GET /api/auth/me` now returns `twoFactor { enabled, enrolledAt }`

### Security

- **Unauthenticated SSE streams** — `/system`, `/docker/stats`, and `/store/operations` built their `ReadableStream` without a session check, so anyone with network access could read live metrics. All three now return 401 before any work happens. `docker/stats/stream` also incremented its connection counter before authenticating, a small DoS vector.
- **2FA hardening** — enrolment and backup-code writes are conditional (compare-and-set) updates, so concurrent requests cannot overwrite an enrolment or spend one backup code twice; partial-auth tokens are rate-limited (429 after 5 wrong codes) and single-use; every wrong-code path collapses to one error shape so responses never reveal which state changed.
- **Username enumeration** — a failed login now runs `verifyPassword` against a fixed dummy hash on the user-not-found path, so response timing no longer leaks whether a username exists.
- **Architecture test guard** — a new spec scans every `app/api/v1/**/route.ts` and fails when an exported handler neither calls `authenticateSession` nor appears in an explicit allowlist. The allowlist snapshots the 65 routes that are currently unauthenticated and can only shrink.

### Fixed

#### Stability & Raspberry Pi hardening

- **Hung compose operations** — `docker compose` subprocesses had no wall-clock bound, so a hung daemon or a dropped Wi-Fi connection mid-pull held the app's operation guard until restart, blocking every later install. Now capped by `DOCKER_COMPOSE_TIMEOUT_MS` (default 5 min, minimum 30 s), with `maxBuffer` limited to 10 MB to protect Pi RAM.
- **Unbounded memory growth** — `latestOperationEvent` gained an entry on every operation step and never dropped them. Terminal entries are now purged after a 60 s grace window (1 s under tests); late clients fall back to the database snapshot.
- **OOM kills on Pi 3** — the entrypoint defaults `NODE_OPTIONS=--max-old-space-size=768` when the operator has not set it, and `docker-compose.yml` gains `mem_limit: 1g` so the OOM killer targets Homeio deterministically instead of a random sibling container.
- **File search blocking the event loop** — `searchFiles` walked the tree with no bound and no yields, stalling SSE heartbeats on large mounted shares. Now bounded by `FILES_SEARCH_TIMEOUT_MS` (default 10 s, per-request override available), yielding between sub-walks and returning a `truncated` flag.
- **Slow graceful shutdown** — the progress `setInterval` in `pullImagesWithProgress` is `unref()`'d, so SIGTERM during an image pull no longer waits out the 8 s shutdown window and risk escalation to SIGKILL.
- **Install script failure** — the nginx config heredoc was unquoted, so bash under `set -u` tried to expand `$host` and aborted mid-install ([#26](https://github.com/doctor-io/homeio/issues/26)).
- **Catalog bootstrap taking down registration** — a single CasaOS stack with duplicate YAML keys threw during the catalog parse, which 500'd `/api/auth/register`. Broken entries are now skipped with a warning, and registration no longer depends on the bootstrap succeeding.
- **Missing `busboy` dependency** — imported at runtime by the file and Google Drive upload routes but absent from `package.json`; a fresh `npm install` would have failed the production build.
- **`DEMO_MODE` ignored** — `/login` was statically prerendered, baking in `isDemoMode=false`, so flipping the flag and restarting changed nothing. The page is now rendered dynamically.
- **TOTP login blocked by the proxy** — `/api/v1/auth/login/totp` returned a generic 401 before the handler ran, since the caller has no session cookie at that point. Added to the public-route allowlist; the route validates its own partial-auth token.

### Changed

- **Multi-arch Docker image** — `ghcr.io/doctor-io/homeio` now publishes `linux/amd64` and `linux/arm64` manifests. Pi 4/5 users no longer receive an emulated x86 image or a "no matching manifest" error.
- `lint-staged` glob contained a stray space (`*.{js, jsx,ts,tsx}`) that silently skipped ESLint on staged `.jsx` files

---

## [1.6.28] - 2026-05-23

### Fixed

#### In-app updater

- **Bug**: in-app updates from 1.6.22+ left the server stuck on "Applying Homeio update…" because `go build` aborted with `GOCACHE is not defined and neither $XDG_CACHE_HOME nor $HOME are defined`. The updater is scheduled via `systemd-run --no-block`, which starts a transient unit with a minimal environment — `$HOME` and `/usr/local/go/bin` were missing. `build_upload_server` exited hard before `start_service` ran, so the recovery screen polled `/api/health` forever.
- Fix: pass `HOME=/root` and an explicit `PATH` (including `/usr/local/go/bin`) to the `systemd-run` invocation in `scheduleSystemUpdate`, and defensively export `HOME`/`GOCACHE`/`GOPATH` inside `build_upload_server` so the script is safe regardless of how it is invoked.

> **Manual recovery for servers already stuck** (the fix can only protect *future* updates):
>
> ```bash
> sudo systemctl start home-server
> sudo bash -c 'export HOME=/root && cd /opt/home-server/services/upload-server && \
>   /usr/local/go/bin/go build -o /opt/home-server/bin/upload-server . && \
>   systemctl restart home-server-upload'
> ```

---

## [1.6.0] - 2026-05-04

### Added

#### Tailscale Integration

- Settings panel for configuring Tailnet and auth key (encrypted at rest)
- Status indicator in the status bar with live popover (hostname, IP, TUN device, connection state)
- Install & activate flow: downloads the official Tailscale Linux client via `install.sh`, enables `tailscaled` via systemd, and runs `tailscale up` — all from the UI
- Local status polling (`tailscale status --json`) with structured error states: `missing_tun`, `service_unavailable`
- Proxmox LXC guidance banner when `/dev/net/tun` is not available

#### Google Drive Integration

- Full OAuth 2.0 flow with encrypted token storage (access + refresh tokens)
- File browser with folder navigation, download, and upload support
- Multiple account connections support
- Redirect URI auto-derived from `window.location.origin` — no manual configuration needed for LAN/Tailscale access

#### Go Upload Sidecar

- Streaming multipart upload server in Go (`services/upload-server/`) routed via nginx Unix socket
- Eliminates Node.js memory pressure for large file uploads (tested up to 10 GB)
- Validates session HMAC locally without a DB round-trip

#### Server Info & Disk Management

- Server information panel: CPU model, RAM, OS, uptime, network interfaces, thermal sensors
- Disk manager: list drives, partitions, usage, mount points
- Disk and temperature warnings in the desktop shell notification area

#### UI — Kora Icon Set

- Replaced all placeholder icons with the Kora SVG icon set
- Added scalable weather, status, and system icons

### Fixed

#### Tailscale (security & correctness — audit follow-up)

- **Bug**: stored auth key was never used for activation; clicking "Activate" with a saved key required retyping it — the install route now reads from the database when no key is provided in the request body
- **Security**: auth key was passed as `--auth-key=<raw>` CLI argument, exposing it in the process list — now written to a mode-0600 temp file and passed as `--auth-key=file:<path>`, cleaned up in `finally`
- **Robustness**: added in-process concurrency lock to prevent overlapping `installTailscale` calls
- **UI**: `status-yellow` CSS token (undefined in theme) replaced with `status-amber`
- **UX**: "Activate" button now enabled when credentials are already saved, even if the auth key field is empty
- **Error display**: install script failures now surface the real `stderr` from `apt-get` instead of a truncated `error.message`

#### Google Drive

- Redirect URI field now shows the correct server URL (`window.location.origin`) instead of always defaulting to `http://localhost:3000`

#### General

- Password fields (`Client secret`, `Auth key`) wrapped in `<form>` elements — eliminates browser accessibility warning and enables Enter-to-submit
- API access hardened; upload route protected
- Upload server Unix socket permissions corrected

### Tests

- 16 new tests covering Tailscale routes and service:
  - `GET /api/v1/system/tailscale/status`: connected, not-installed, error
  - `POST /api/v1/system/tailscale/install`: body key, stored key fallback, no key, TUN error, concurrency guard
  - `getLocalTailscaleStatus`: CLI absent, Running state, missing TUN, service unavailable
  - `installTailscale`: file-based key, temp file cleanup on failure, concurrency rejection

### Infrastructure

- `scripts/install.sh`: hostname configuration, Node 22, Go 1.23, Docker, yq, nginx reverse proxy, systemd units for main app + upload sidecar + D-Bus helper
- `scripts/update.sh`: zero-downtime update flow with service restart
