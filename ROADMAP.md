# Homeio Roadmap

This document outlines what's shipping now and what's planned for future releases. It's a living document — priorities shift based on community feedback. If something here matters to you, open an issue or leave a 👍 on the relevant discussion.

**Current stable release:** [v1.4.x](https://github.com/doctor-io/homeio/releases)  
**In active development:** v1.7

---

## What's in v1.4

- **Desktop shell** — command palette (`⌘K`), improved dock and window management
- **Container Logs Viewer** — real-time SSE log streaming from the app context menu; timestamp formatting, log-level badges (`ERROR` / `WARN` / `INFO` / `DEBUG`), keyword filter, auto-scroll, download
- **UI unification** — consistent surface token system (`PANEL_SHELL`, `PANEL_INSET`, `BADGE_SURFACE`, `MENU_SHELL`) applied across all modules; standardised spacing, shadows, and border radii
- **Full-screen file preview** — expand any file preview (image, video, audio, PDF, text) to full screen from the file manager toolbar

---

## v1.5 — Productivity

> *Features that reduce the need to SSH in.*

**Status: active development**

### Monaco File Editor ✅

The text preview is now a full code editor:

- Syntax highlighting for `.json`, `.yaml`, `.env`, `.sh`, `.toml`, `.ts`, `.conf`, `.nginx`, `.xml`, and more — auto-detected from file extension
- Line numbers, code folding, find-and-replace
- Format on save for JSON and YAML
- Unsaved-changes indicator with discard confirmation
- Edit Docker Compose files, `.env` configs, and shell scripts from the file manager without SSH

### Notification System ✅

- Persistent `notifications` table in PostgreSQL
- Event sources: app install/update/uninstall, container crash, disk above 85%, backup result, scheduled task failure, system update available
- Real-time delivery via SSE
- Mark as read, clear all
- Notification preferences per category in Settings

### Scheduled Tasks ✅

A built-in cron job runner — no SSH, no crontab editing:

- Create tasks with a cron expression or a plain-language preset (daily, weekly, etc.)
- Task types: run a shell command (from the existing allowlist), restart an app, trigger a backup, pull latest Docker images
- Last run result and timestamp per task
- Enable / disable without deleting
- Failure notifications via the notification system

### USB Drive Support 🚧

Detect, mount, and browse USB drives from the file manager:

- USB devices appear in the file manager sidebar under "Removable" as soon as they are plugged in, using `udev` events
- One-click mount and unmount via udisks2 D-Bus
- Safe eject before unplugging
- Full file manager access to mounted drives — browse, copy, move, upload, download
- Auto-mount option per device in Settings

---

## v1.6 — Storage Expansion

> *Homeio as the central hub for all your data.*

### Disk & Partition Manager

Homeio already installs `parted`, `e2fsprogs`, and `gdisk` on bare-metal setups — this release surfaces them:

- List all block devices, partitions, mount points, and usage
- Format a partition (ext4, exFAT, NTFS)
- Mount / unmount with optional auto-mount at boot (writes `/etc/fstab`)
- Create and delete partitions
- Wipe a disk
- Clear warnings before any destructive action — every dangerous operation requires explicit confirmation

### Google Drive Integration

Mount a Google Drive account as a location in the file manager:

- OAuth2 flow — connect an account from Settings → Storage → Cloud Accounts
- Google Drive appears in the file manager sidebar alongside local and network locations
- Browse folders, preview files, upload, download, move within Drive
- Multiple accounts supported
- OAuth tokens stored encrypted in the database (same pattern as SMB credentials)
- Files are not synced locally — accessed on demand via the Drive API

---

## v1.7 — Stability, Pi Hardening, Reverse Proxy & Security

> *Make it solid everywhere it runs, close the loop from container to HTTPS URL, and add a second lock on the door.*

**Status: active development**

### Stability & Raspberry Pi Hardening

A focused pass on reliability issues that surface most on low-memory ARM hardware:

- **SSE stream authentication** — three unauthenticated streams (`/system`, `/docker/stats`, `/store/operations`) are secured; unauthenticated requests now return HTTP 401
- **Docker compose timeout** — all subprocess calls to `docker compose` are capped at a configurable `DOCKER_COMPOSE_TIMEOUT_MS` (default 5 min) to prevent hung operations from locking the queue permanently
- **In-memory leak fix** — `latestOperationEvent` map is pruned when operations complete, preventing unbounded heap growth on long-running instances
- **Node.js heap cap** — `NODE_OPTIONS=--max-old-space-size=768` honoured via `docker-entrypoint.sh`; prevents OOM kills on Pi 3 (1 GB RAM)
- **Multi-arch Docker image** — release image now includes `linux/amd64` and `linux/arm64` manifests; Pi 4/5 users no longer receive an emulated amd64 image
- **Search file timeout** — `searchFiles` yields the event loop between directory levels and stops after a configurable deadline; large NFS mounts no longer block SSE heartbeats
- **Graceful shutdown fix** — progress `setInterval` in `pullImagesWithProgress` is `unref()`'d so SIGTERM during an active image pull exits cleanly within the 8-second window
- **Architecture test guard** — automated test added to prevent unauthenticated `/api/v1/**` route handlers from slipping through code review

### Reverse Proxy & SSL Certificate Management

The biggest missing piece for any home server: expose your services over HTTPS with custom domains — without touching nginx config files.

**Proxy rules**

- Add a proxy rule from within Homeio: pick an app (its exposed port is auto-detected from the compose file), enter a domain name, and Homeio writes and reloads the nginx configuration
- Rules are stored in the database and survive restarts; nginx config is regenerated on startup
- Each app card gets an "Expose" button — one click to create a proxy rule for that container
- Support wildcard subdomains (`*.homelab.local`) for local setups and named domains for internet-facing installs

**SSL / Let's Encrypt**

- Automated certificate provisioning via ACME (Let's Encrypt or ZeroSSL) for any domain pointed at your server
- Self-signed certificate generation for local/LAN domains that cannot use ACME
- Certificate status, expiry date, and next renewal shown in the proxy rule list
- Auto-renewal runs on Homeio's existing scheduled task engine; failure triggers a notification
- HTTP → HTTPS redirect enforced automatically for any rule with a valid certificate

**Dynamic DNS (DDNS)**

- Connect a DDNS provider (Cloudflare, DuckDNS, No-IP) from Settings → Network → DDNS
- Homeio polls your WAN IP and updates DNS records when it changes — runs as a scheduled task
- Status and last-updated timestamp visible in Settings

**Why this matters:** today every Homeio user who wants HTTPS must install Nginx Proxy Manager alongside Homeio and configure it separately. This release closes that loop — Homeio already knows every container's ports, and now it can manage the path from domain name to HTTPS endpoint in the same UI.

### SMART Disk Health Monitoring

Disk failure is the most common reason a home server loses data. v1.7 surfaces the early warning signs before failure hits:

- Read SMART attributes for every physical drive via `smartctl`: reallocated sectors, pending sectors, uncorrectable errors, power-on hours, and drive temperature
- Overall health status per disk (Passed / Warning / Failed) shown in the System module
- Drive temperature included in the real-time system metrics panel
- Notification triggered when any SMART attribute crosses a failure threshold — same notification pipeline as container crashes and task failures
- Schedule short and long SMART self-tests from the Scheduled Tasks module

### Hardware Sensor Monitoring

A home server running 24/7 needs thermal visibility — Homeio now exposes it:

- CPU die temperature and per-core temperature via `/sys/class/thermal` and `lm-sensors`
- NVMe and SSD temperatures via `smartctl -A` (shares the SMART integration above — no extra dependency)
- Fan RPM for chassis and CPU fans where the kernel exposes them
- All sensors displayed in the System module alongside existing CPU %, RAM, and disk usage

### Two-Factor Authentication (TOTP)

Once your server is exposed via the reverse proxy in this same release, a second factor becomes critical. v1.7 ships TOTP for the single-user account:

- Set up an authenticator app (Google Authenticator, Authy, 1Password, Bitwarden) via QR code from Settings → Security
- TOTP is required on every login once enabled; there is no grace period
- 10 one-time backup codes generated at setup — store them offline; each code can only be used once
- Disable 2FA only by providing the current TOTP code or a backup code — cannot be bypassed from the login screen

> Multi-user 2FA enforcement (requiring all users to enrol) ships in v2.0 alongside the multi-user model itself.

---

## v1.8 — Observability & Docker Power Tools

> *See deeper into what your server is doing — and take more direct control of it.*

### Metrics History

System and container metrics have always been real-time only. v1.8 persists them:

- CPU, memory, disk I/O, and network throughput sampled every 30 seconds and stored in PostgreSQL with configurable retention (default 30 days)
- Per-container CPU and memory history alongside existing real-time stats
- CPU temperature and drive temperatures (from v1.7's sensor and SMART integration) included in the time-series — spot thermal spikes correlated with load
- Time-range selector on all monitor graphs: Last 1 h / 6 h / 24 h / 7 d / 30 d
- Automatic data pruning — a scheduled task trims rows older than the retention window; no manual cleanup needed

### Docker Image Manager

Today Homeio manages apps at the compose level. v1.8 adds direct image control:

- Browse all locally pulled Docker images: name, tag, size, creation date, and which compose apps reference them
- Pull an image by name and tag without writing a compose file
- Remove unused images individually or prune all dangling images in one click (with a size-reclaim preview)
- Inspect image layers and exposed ports
- Images that belong to installed apps are clearly labelled — the UI warns before removing a referenced image

### Webhooks

Send outbound HTTP notifications to external services when Homeio events fire:

- Configure webhook endpoints from Settings → Integrations: URL, HTTP method, optional secret for HMAC signing
- Trigger on any notification category: app installed/updated/crashed, disk warning, task failure, certificate renewed, SMART alert
- Payload is a JSON object matching the existing notification schema — the same shape used by the SSE notification stream
- Delivery log with status code, response time, and retry history per endpoint
- Manual "Test" button sends a sample payload immediately without waiting for a real event

### ARMv7 (32-bit Pi 2/3) Support

Carried over from v1.7 scope:

- Investigate and resolve `@lydell/node-pty` prebuilt availability for `linux/arm/v7`
- Add `linux/arm/v7` to the release workflow multi-arch build if prebuilts exist; otherwise document a build-from-source path for Pi 2/3 users
- End-to-end smoke test on ARMv7 hardware or QEMU

### File Manager Enhancements

Smaller quality-of-life additions deferred from earlier releases:

- **Zip / unzip** — compress a selection of files or folders into a `.zip` archive; extract `.zip`, `.tar.gz`, and `.tar` archives in place
- **Bulk rename** — rename multiple selected files with a find-and-replace pattern or sequential numbering
- **Batch delete** — multi-select delete with a single confirmation prompt instead of one confirmation per file
- **3-part Docker port spec fix** — `applyWebUiPortOverride` now handles `IP:HOST:CONTAINER` mappings (e.g. `0.0.0.0:8080:80`) correctly instead of silently leaving them unchanged

---

## v2.0 — Multi-User & Security

> *Homeio for shared servers — families, flatmates, teams.*

This is a larger architectural change. All of the above ships first.

### Multi-User with Role-Based Access

Today Homeio is single-user by design. v2.0 opens this up:

| Role | Capabilities |
|------|--------------|
| **Admin** | Full access — installs, deletes, settings, power control |
| **User** | Manage own files, launch apps, view metrics — no installs or system changes |
| **Viewer** | Read-only — metrics dashboard, file browsing only |

- Admins invite users by username; registration re-opens for the duration of the invite
- Per-app access control: admins can restrict specific apps to specific users
- Each user has isolated file manager roots (optional — configurable by admin)

### API Tokens

Token-based authentication for programmatic access — integrations with Home Assistant, n8n, scripts, and third-party tools:

- Generate named tokens with optional expiry from Settings → Security
- `Authorization: Bearer <token>` on any API endpoint
- Scoped permissions: read-only, app management, file access, system control
- Token usage log — last used timestamp and source IP

### Two-Factor Authentication — Admin Enforcement

Single-user TOTP ships in v1.7. v2.0 extends it for teams:

- Admins can mark 2FA as required for all user roles or specific roles only
- Users who have not enrolled are prompted to set up TOTP on next login; they cannot proceed until they do
- Admin dashboard shows 2FA enrolment status per user
- Admins can reset a user's 2FA (e.g. lost authenticator) and issue a temporary bypass code valid for one login

### Audit Log

Every action recorded with user, timestamp, and result:

- App installs, updates, uninstalls
- File operations (delete, move, share)
- Power control actions
- Settings changes
- Authentication events
- Viewable in Settings → Logs

---

## Under Consideration

These are not scheduled yet. Community interest will determine if and when they move to a release.

- **Mobile-optimised layout** — the current UI is desktop-first; a responsive layout for phone access to the most common actions
- **WebSocket / SSE multiplexing** — consolidate multiple SSE streams into a single connection to reduce per-client overhead on low-memory devices
- **Portainer-style container control** — create containers from images directly, not just from Compose templates; inspect and exec into running containers
- **Observability stack** — Prometheus metrics endpoint and optional Grafana dashboard sidecar for users who want long-term time-series beyond the built-in 30-day retention
- **External secret management** — Vault, Docker secrets, or `.env` file encryption for sensitive app credentials
- **Terminal multi-pane** — split terminal into multiple panes; tabs with named sessions

---

## What This Project Is Not

To set clear expectations for contributors and users:

- **Not a NAS OS replacement** — Homeio manages applications and files but does not aim to replace TrueNAS, Unraid, or similar full NAS operating systems
- **Not a Kubernetes orchestrator** — Docker Compose is the deployment target; Swarm/K8s orchestration is out of scope
- **Not a cloud service** — everything runs locally; no Homeio cloud accounts, no telemetry, no calling home

---

*Updated May 2026 · [Open an issue](https://github.com/doctor-io/homeio/issues) to suggest a feature or report a problem*
