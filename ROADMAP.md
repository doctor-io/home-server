# Homeio Roadmap

This document outlines what's shipping next and what's planned for future releases. It's a living document — priorities shift based on community feedback. If something here matters to you, open an issue or leave a 👍 on the relevant discussion.

**Current stable release:** [v1.3.x](https://github.com/doctor-io/homeio/releases)

---

## What's already in v1.3

Before looking ahead — here's the baseline Homeio ships with today:

- **Desktop shell** — dock, draggable/resizable windows, command palette (`⌘K`), lock screen
- **App Store** — install, update, uninstall Docker Compose apps; compatible with CasaOS store archives; custom sources
- **File manager** — browse, upload/download, multi-select, copy/move, conflict resolution, trash, starred files, Samba shares, SMB network mounts, media preview (audio/video/image/PDF)
- **System monitor** — real-time CPU, memory, disk, network via SSE; Docker container stats
- **Network manager** — WiFi and Ethernet via NetworkManager D-Bus
- **Terminal** — integrated with command allowlist, search, history
- **Settings** — appearance (theme/wallpaper), power controls (reboot/shutdown/schedule), system updates with rollback, backups, user management
- **Weather widget** — location-based via Open-Meteo

---

## v1.4 — Polish & UX

> *Fixing what's rough before adding more surface area.*

This release focuses on making the existing experience feel intentional and cohesive. No new modules — just raising the quality bar across the board.

### UI Unification

The current UI mixes several visual languages: the app grid uses bare icon buttons, system widgets use glass morphism cards, the file manager uses its own surface tokens, and dialogs have inconsistent padding and spacing. This release standardises everything.

- Define a clear surface hierarchy (`--surface-1` through `--surface-4`) and apply it consistently
- Standardise card anatomy across app grid, file manager, settings panels, and widgets: border radius, padding, shadow, and hover/active states follow the same rules everywhere
- Unify the loading skeleton pattern — one component, used everywhere
- Consistent empty state design (icon, title, description, optional action)
- Icon size and colour normalisation — everything uses the same 4-step size scale and the same semantic colour tokens
- Typography scale clean-up — remove ad-hoc `text-[11px]` / `text-[13px]` in favour of the Tailwind type scale

### Container Logs Dialog

Today, "View Logs" opens the terminal and dumps `docker logs --tail 200 {name}` into it — noise, no formatting, no streaming. This is being replaced with a dedicated **Logs Viewer dialog**:

- Opens as a floating dialog from the app context menu (not the terminal)
- Streams logs in real time via a new `/api/v1/apps/[appId]/logs/stream` SSE endpoint (`docker logs -f`)
- Timestamps displayed and formatted
- Log level detection with coloured badges — `ERROR` (red), `WARN` (yellow), `INFO` (blue), `DEBUG` (muted)
- Search / filter by keyword
- Auto-scroll with a "pause scroll" toggle
- Download raw log button
- The terminal remains for interactive use — it is no longer involved in log viewing

### Full-Screen File Preview

The current file preview is locked inside the file manager panel. Added: a full-screen toggle on the preview toolbar that expands the viewer to cover the full window (`position: fixed, inset: 0`). Works for all preview types — image, video, audio, PDF, text. Press `Escape` or click the collapse button to return.

---

## v1.5 — Productivity

> *Features that reduce the need to SSH in.*

### Monaco File Editor

The text preview already exists. This upgrades it to a full code editor:

- Syntax highlighting for `.json`, `.yaml`, `.env`, `.sh`, `.toml`, `.ts`, `.conf`, `.nginx`, `.xml`, and more — automatically detected from file extension
- Line numbers, code folding, find-and-replace
- Format on save for JSON and YAML
- Unsaved-changes indicator and discard confirmation
- Directly edit Docker Compose files, `.env` configs, and shell scripts from the file manager without SSH

### Scheduled Tasks

A built-in cron job runner — no SSH, no crontab editing:

- Create tasks with a cron expression or a plain-language schedule picker (daily at 3am, every Monday, etc.)
- Task types: run a shell command (from the existing allowlist), restart an app, trigger a backup, pull latest Docker images
- View last run result and timestamp
- Enable / disable without deleting
- Notification on failure (see below)

### Notification System

The notification popover exists in the status bar but has no backend. This wires it up:

- Persistent `notifications` table in PostgreSQL
- Event sources: app install/update/uninstall complete, container crash detected (via Docker event stream), disk usage above 85%, backup completed or failed, scheduled task failed, system update available
- Real-time delivery via the existing SSE infrastructure
- Mark as read, clear all
- Notification preferences per category in Settings

### USB Drive Support

Detect, mount, and browse USB drives directly from the file manager:

- USB devices appear in the file manager sidebar under "Removable" as soon as they are plugged in, using `udev` events
- One-click mount and unmount via udisks2 D-Bus (same D-Bus infrastructure already used for networking)
- Safely eject before unplugging
- Full file manager access to mounted drives — browse, copy, move, upload, download
- Auto-mount option per device in Settings

---

## v1.6 — Storage Expansion

> *Homeio as the central hub for all your data.*

### Disk & Partition Manager

Homeio already installs `parted`, `e2fsprogs`, and `gdisk` on bare-metal setups — but there is no UI. This release surfaces them:

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
- Files are not synced locally — they are accessed on demand via the Drive API

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

*Updated April 2026 · [Open an issue](https://github.com/doctor-io/homeio/issues) to suggest a feature or report a problem*
