# Homeio Roadmap

This document outlines what's shipping now and what's planned for future releases. It's a living document — priorities shift based on community feedback. If something here matters to you, open an issue or leave a 👍 on the relevant discussion.

**Current release line:** v1.6.x  
**Package version in this branch:** v1.6.13

---

## What's in v1.4

- **Desktop shell** — command palette (`⌘K`), improved dock and window management
- **Container Logs Viewer** — real-time SSE log streaming from the app context menu; timestamp formatting, log-level badges (`ERROR` / `WARN` / `INFO` / `DEBUG`), keyword filter, auto-scroll, download
- **UI unification** — consistent surface token system (`PANEL_SHELL`, `PANEL_INSET`, `BADGE_SURFACE`, `MENU_SHELL`) applied across all modules; standardised spacing, shadows, and border radii
- **Full-screen file preview** — expand any file preview (image, video, audio, PDF, text) to full screen from the file manager toolbar

---

## v1.5 — Productivity ✅ Released

> *Features that reduce the need to SSH in.*

### Monaco File Editor

The text preview is now a full code editor:

- Syntax highlighting for `.json`, `.yaml`, `.env`, `.sh`, `.toml`, `.ts`, `.conf`, `.nginx`, `.xml`, and more — auto-detected from file extension
- Line numbers, code folding, find-and-replace
- Format on save for JSON and YAML
- Unsaved-changes indicator with discard confirmation
- Edit Docker Compose files, `.env` configs, and shell scripts from the file manager without SSH

### Notification System

- Persistent `notifications` table in PostgreSQL
- Event sources: app install/update/uninstall, container crash, disk above 85%, backup result, scheduled task failure, system update available
- Real-time delivery via SSE
- Mark as read, clear all
- Notification preferences per category in Settings

### Scheduled Tasks

A built-in cron job runner — no SSH, no crontab editing:

- Create tasks with a cron expression or a plain-language preset (daily, weekly, etc.)
- Task types: run a shell command (from the existing allowlist), restart an app, trigger a backup, pull latest Docker images
- Last run result and timestamp per task
- Enable / disable without deleting
- Failure notifications via the notification system

### USB Drive Support

Detect, mount, and browse USB drives from the file manager:

- USB devices appear in the file manager sidebar under "Removable" as soon as they are plugged in, using `udev` events
- One-click mount and unmount via udisks2 D-Bus
- Safe eject before unplugging
- Full file manager access to mounted drives — browse, copy, move, upload, download
- Auto-mount option per device in Settings

---

## v1.6 — Storage Expansion & Polish ✅ Current

> *Homeio as the central hub for all your data.*

**Status: shipping in the 1.6.x line**

### Bug Fixes & Cross-Browser Compatibility 🚧

- Firefox: blur overlay appearing over flyout popovers and the status bar when open
- Firefox: app grid icons not centered / incorrect rendering inside rounded containers

### Disk & Partition Manager

Homeio already installs `parted`, `e2fsprogs`, and `gdisk` on bare-metal setups — this release surfaces them:

- List all block devices, partitions, mount points, and usage
- Format a partition (ext4, exFAT, NTFS)
- Mount / unmount with optional auto-mount at boot (writes `/etc/fstab`)
- Create and delete partitions
- Wipe a disk
- Clear warnings before any destructive action — every dangerous operation requires explicit confirmation

### Server Information

The Settings app now includes a server information view:

- Hostname, OS, kernel, uptime, CPU, memory, and filesystem details
- Network interface inventory with address, speed, and traffic fields where available
- Thermal readings where the host exposes sensor data
- Disk and temperature warnings feed recent actions and notifications

### Google Drive Integration

Use Google Drive accounts as file manager locations:

- OAuth2 setup from Settings → Integrations, with encrypted client secret storage
- OAuth2 flow for connecting accounts once the Google Cloud credentials are configured
- Google Drive appears in the file manager sidebar alongside local and network locations
- Browse folders, preview files, upload, download, create folders, move, and delete within Drive
- Multiple accounts supported
- OAuth tokens stored encrypted in the database
- Files are not synced locally — accessed on demand via the Drive API

### Safer Large Uploads

- Next.js upload route now stream-parses multipart requests with `busboy` instead of buffering complete uploads in memory
- Bare-metal installs include a Go upload sidecar that listens on `/run/home-server/upload.sock`
- Install and update scripts build the sidecar, write the systemd unit, and report service/unit-file status
- Upload socket permissions are set so the app process can read and write through the socket
- Upload progress and cancellation remain available in the file manager UI

### Shell & Visual Polish

- Dock and file-type icons now use bundled Kora-style assets with platform icon fallbacks
- File manager supports archive extraction through the existing file operation route
- Cross-browser visual fixes continue for Firefox blur and icon rendering issues

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

### Two-Factor Authentication (TOTP)

- Authenticator app setup (QR code) from Settings → Security
- Required on next login once enabled
- Backup codes generated at setup
- Admin can enforce 2FA for all users

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

- **SSL / Let's Encrypt** — automated certificate management and Nginx HTTPS configuration from within the UI
- **Metrics history** — store system and per-container metrics in PostgreSQL and add time-range selectors (1h / 24h / 7d) to the monitor graphs
- **Portainer-style container control** — create containers from images directly, not just from Compose templates
- **Reverse proxy manager** — manage Nginx proxy rules for apps without editing config files
- **Webhooks** — send outbound HTTP notifications to external services on Homeio events
- **Mobile-optimised layout** — the current UI is desktop-first; a responsive layout for phone access to the most common actions

---

## What This Project Is Not

To set clear expectations for contributors and users:

- **Not a NAS OS replacement** — Homeio manages applications and files but does not aim to replace TrueNAS, Unraid, or similar full NAS operating systems
- **Not a Kubernetes orchestrator** — Docker Compose is the deployment target; Swarm/K8s orchestration is out of scope
- **Not a cloud service** — everything runs locally; no Homeio cloud accounts, no telemetry, no calling home

---

*Updated May 2026 · [Open an issue](https://github.com/doctor-io/homeio/issues) to suggest a feature or report a problem*
