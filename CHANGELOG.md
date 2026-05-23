# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
