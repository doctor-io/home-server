# Homeio Roadmap

This document outlines what's shipping now and what's planned for future releases. It's a living document — priorities shift based on community feedback. If something here matters to you, open an issue or leave a 👍 on the relevant discussion.

**Current stable release:** [v1.7.24](https://github.com/doctor-io/homeio/releases)  
**In active development:** v2.0 — setup wizard, custom compose, auto-heal, Home Assistant, Tailscale exposure, mobile v2  
**Next:** v2.1 (reverse proxy, SSL, disk health) · v2.2 (multi-user)

> **Versioning note:** there is no v1.8 or v1.9. v2.0 bundles six feature tracks that ship together, so the next release after v1.7.24 is v2.0.

---

## v1.4 — Desktop Shell ✅ Shipped

- **Desktop shell** — command palette (`⌘K`), improved dock and window management
- **Container Logs Viewer** — real-time SSE log streaming from the app context menu; timestamp formatting, log-level badges (`ERROR` / `WARN` / `INFO` / `DEBUG`), keyword filter, auto-scroll, download
- **UI unification** — consistent surface token system (`PANEL_SHELL`, `PANEL_INSET`, `BADGE_SURFACE`, `MENU_SHELL`) applied across all modules; standardised spacing, shadows, and border radii
- **Full-screen file preview** — expand any file preview (image, video, audio, PDF, text) to full screen from the file manager toolbar

---

## v1.5 — Productivity ✅ Shipped

> *Features that reduce the need to SSH in.*

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

### USB Drive Support ✅

Detect, mount, and browse USB drives from the file manager:

- USB devices appear in the file manager sidebar under "Removable" as soon as they are plugged in, using `udev` events
- One-click mount and unmount via udisks2 D-Bus
- Safe eject before unplugging
- Full file manager access to mounted drives — browse, copy, move, upload, download
- Auto-mount option per device in Settings

---

## v1.6 — Storage Expansion ✅ Shipped

> *Homeio as the central hub for all your data.*

### Disk & Partition Manager ✅

Homeio already installs `parted`, `e2fsprogs`, and `gdisk` on bare-metal setups — this release surfaces them:

- List all block devices, partitions, mount points, and usage
- Format a partition (ext4, exFAT, NTFS)
- Mount / unmount with optional auto-mount at boot (writes `/etc/fstab`)
- Create and delete partitions
- Wipe a disk
- Clear warnings before any destructive action — every dangerous operation requires explicit confirmation

### Google Drive Integration ✅

Mount a Google Drive account as a location in the file manager:

- OAuth2 flow — connect an account from Settings → Storage → Cloud Accounts
- Google Drive appears in the file manager sidebar alongside local and network locations
- Browse folders, preview files, upload, download, move within Drive
- Multiple accounts supported
- OAuth tokens stored encrypted in the database (same pattern as SMB credentials)
- Files are not synced locally — accessed on demand via the Drive API

---

## v1.7 — Stability, Pi Hardening & Two-Factor Auth ✅ Shipped

> *Make it solid everywhere it runs, and add a second lock on the door.*

**Released 2026-07-02 as v1.7.24.** The reverse proxy, SSL, DDNS, SMART, and sensor work originally scoped here did not make the release and has moved to [v2.1](#v21--exposure-observability--docker-power-tools) — see [CHANGELOG.md](./CHANGELOG.md) for what actually shipped.

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

### Two-Factor Authentication (TOTP)

A second factor matters as soon as Homeio is reachable beyond the LAN — over Tailscale today, and over the v2.1 reverse proxy later. v1.7 ships TOTP for the single-user account:

- Set up an authenticator app (Google Authenticator, Authy, 1Password, Bitwarden) via QR code from Settings → Security
- TOTP is required on every login once enabled; there is no grace period
- 10 one-time backup codes generated at setup — store them offline; each code can only be used once
- Disable 2FA only by providing the current TOTP code or a backup code — cannot be bypassed from the login screen

> Single-user TOTP shipped in v1.7.23. Multi-user 2FA enforcement (requiring all users to enrol) ships in v2.2 alongside the multi-user model itself.

---

## v2.0 — Setup, Apps, Recovery & Reach

> *Make Homeio easy to start, easy to fill with apps, hard to knock over, and reachable from anywhere.*

**Status: active development.** Tracks 1, 2 and 3 are complete on the `v2.0` branch, as is
the API-token half of Track 4. Track 5 (expose over Tailscale) was dropped from this release,
and the Home Assistant component is paused pending a packaging decision. Active work is
Track 6 (mobile v2) and Track 7 (the phone UI). Status is marked per track below.

**There is no v1.8 or v1.9.** The six tracks below land together as one release, so the version jumps from v1.7.24 straight to v2.0. Everything previously scoped for v1.8 — reverse proxy, SSL, DDNS, SMART, sensors, metrics history — moves to [v2.1](#v21--exposure-observability--docker-power-tools). Multi-user and RBAC move to [v2.2](#v22--multi-user--access-control).

### Shipping rules for v2.0

Homeio is already running on other people's servers. Every track in this release follows the same rules — they are requirements, not preferences:

- **Additive migrations only.** New tables, and new columns that are nullable or carry a default. No dropped columns, no type changes, no backfill that rewrites existing rows. Every migration must be safe to apply to a live v1.7.24 database.
- **No breaking API changes.** Every existing `/api/v1` route keeps its request and response shape. New behaviour goes on new routes, or behind new optional fields that older clients ignore.
- **Off by default.** Every new subsystem — auto-heal, API tokens, Tailscale exposure — ships disabled until the operator turns it on. Someone who updates and changes nothing must get exactly the Homeio they had yesterday.
- **Feature-flagged where it is risky.** Anything touching the container lifecycle or the auth path is gated by an environment variable, so it can be switched off without downgrading the image.
- **Regression pass before the tag.** Each track lands as its own PR with unit and route tests. The full suite plus a manual pass on the demo instance runs before release. The `/api/v1` auth allowlist snapshot introduced in v1.7 may only shrink — never grow.

---

### Track 1 — First-Run Setup Wizard ✅ Complete

Today a new install drops you at `/register`, and then straight into an empty desktop. Timezone is wrong, storage is undefined, there is no remote access, 2FA is off, and no apps are installed. Most people who abandon Homeio abandon it in the first ten minutes — this track owns those ten minutes.

**UI design**

- A full-screen `/setup` route that lives *outside* the desktop shell — no dock, no windows, no lock screen. It reuses the existing surface tokens (`PANEL_SHELL`, `PANEL_INSET`) so it feels like Homeio rather than a bolted-on installer.
- A left step rail with five numbered steps and a progress indicator; the active step is a single centred card, roughly 560 px wide, one decision per screen.
- Every step has **Skip** as a first-class button next to **Continue**, never hidden. Skipping is a valid path through the entire wizard.
- Progress is saved on every step transition, so closing the tab and coming back resumes where you left off rather than restarting.
- A closing summary card lists what was configured and what was skipped, with a "Finish" button that fades into the desktop and highlights the dock item for whatever the user installed.
- Keyboard: `Enter` advances, `Esc` skips, `←` goes back. The layout is single-column and touch-friendly, because it is also the first thing a mobile-app user sees.

**The five steps**

1. **Locale & timezone** — timezone, pre-selected from the browser and editable. Timezone matters immediately: scheduled tasks and log timestamps are wrong without it. *The 12/24-hour clock and first-day-of-week controls were deferred:* `AppearanceSettings` has no field for either, so they need new appearance keys plus an appearance API change — a shipped settings surface, which does not belong inside a wizard commit.
2. **Storage** — pick the default file-manager root and where app data lives. Shows detected drives from the existing disk manager with free space; warns when the choice is on the same partition as the OS; offers to mount a detected USB or SMB share.
3. **Remote access** — the existing Tailscale install-and-activate flow, inline. Ends by showing the tailnet address and a QR code that the mobile app can scan to pair (Track 6).
4. **Security** — enable 2FA using the v1.7 enrolment wizard, embedded rather than duplicated, plus session length. Skippable, but shows a plain warning when step 3 enabled remote access.
5. **First app** — a six-tile grid of common starters (Jellyfin, Nextcloud, Home Assistant, Vaultwarden, Immich, Pi-hole) plus "Browse the store" and "Paste my own compose" (Track 2). Installs in the background so the wizard finishes without waiting on a pull.

**Data & API**

- `settings` (a singleton row) gains nullable `onboarding_completed_at`, `timezone`, `default_storage_root`, and `onboarding_step`.
- **Existing installs must never see the wizard.** *Revised during implementation:* a migration backfill does not work here — Docker deploys run `drizzle-kit push`, which never executes migration SQL, and `db:init` replays every migration from scratch, so a backfill would both miss real upgraders and re-fire mid-wizard. The wizard **opts in** instead: state stays NULL until the first registration writes `'pending'`, guarded on `IS NULL`. Upgraders skip setup by construction under either migration path.
- New routes: `GET /api/v1/setup/state`, `POST /api/v1/setup/step`, `POST /api/v1/setup/complete`. Each step writes only its own keys.

**Stability**

- The wizard is never a gate. Skipping everything must leave an install identical to what v1.7.24 produces today.
- Every step is independently recoverable: a failing Tailscale install or a failing app pull surfaces an inline error and still lets you continue.
- `/setup` requires an authenticated session, so it cannot be used to read hardware details pre-login.

**Performance**

- Static route, no polling; the drive scan runs once per step entry and is cached for the session.
- The Tailscale reachability probe is bounded by an explicit timeout so a dead tailnet cannot hang the step.
- Zero cost on the normal boot path: the completion check reads the settings singleton that is already loaded.

**Done when** — a fresh install walks all five steps and lands on a configured desktop; an upgraded v1.7 install never sees `/setup`; a mid-wizard refresh resumes at the same step; skipping every step produces the current v1.7.24 end state.

---

### Track 2 — Bring Your Own Compose ✅ Complete

"My app isn't in your store" is the most common reason someone bounces to Portainer. Note that **much of the backend already exists**: the `custom_store_apps` table, `convertDockerRunToCompose()`, and `POST /api/v1/store/custom-apps/install` shipped earlier and work today. What is missing is a UI and URL import — this track is an extension, not a new subsystem.

**UI design**

- An **Add app** button in the App Store toolbar opens a modal with three tabs: **Paste compose**, **Docker run command**, and **From URL**.
- The paste tab is the Monaco editor already used by the file manager, in YAML mode, with inline validation markers — no new editor dependency.
- Below the editor, a live preview card parses as you type and shows what will actually be created: app name, images, published ports, volume mounts, and environment variable count. Nothing installs until that card renders cleanly.
- Conflict detection before install: a published port already in use, a container name already taken, or a bind mount outside the configured storage root each raise an inline warning with a suggested fix.
- The **Docker run** tab converts to compose on the fly and shows the generated YAML in the same preview, so the user sees exactly what gets written.
- Installed custom apps get a **Custom** badge in the store list and an **Edit compose** action that reopens the editor and redeploys through the normal update path.

**Feature scope**

- Import from a URL: GitHub raw, a gist, or any HTTPS URL. Optionally pin to a commit SHA so a re-import is reproducible.
- Re-import / check-for-update on URL-sourced apps, with a diff view of what changed before applying.
- Export any custom app back out as a compose file.
- Per-app `.env` editing reusing the existing env-path resolution.

**Data & API**

- Reuse `custom_store_apps`; add nullable `source_url`, `source_ref`, `source_checksum`, `last_imported_at`. `source_type` gains `"url"` alongside the existing `"docker-compose"` and `"docker-run"`.
- Existing custom-app routes keep their contracts exactly; URL import is a new `POST /api/v1/store/custom-apps/import`.

**Stability**

- Validation happens before anything touches disk: parse the YAML, reject unknown top-level keys, reject `privileged: true` and host-network without an explicit confirmation checkbox.
- Installs run through the same `executeStoreOperation` queue and `DOCKER_COMPOSE_TIMEOUT_MS` cap as store apps, so a bad compose file cannot wedge the queue — the v1.7 timeout work already covers this path.
- Fetching is server-side with a size cap (5 MB), a request timeout (10 s), redirect limits, and a block on private IP ranges unless the operator explicitly allows LAN sources in Settings.
- The v1.7 catalog fix already skips malformed entries rather than failing the bootstrap, so a broken custom template cannot take down the store.

**Performance**

- Compose input is capped (256 KB) and parsed once, client-side for preview and server-side for install — no double round-trip while typing.
- The preview parse is debounced and runs off the render path so a large file does not stall the editor.

**Done when** — a compose file pasted from a project README installs and appears in the dock; a GitHub raw URL installs and can be re-checked for updates; a malformed file produces an inline error and never reaches disk; existing custom-app API consumers see no change.

---

### Track 3 — Container Auto-Heal ✅ Complete

Homeio can already tell you a container crashed. It cannot do anything about it. This track closes the loop between the notification system and the container lifecycle.

**UI design**

- Each app's settings panel gains a **Health & recovery** section: restart policy (`no` / `on-failure` / `always` / `unless-stopped`), a restart budget ("stop and alert after N restarts in M minutes"), and the action to take when the budget is exhausted.
- App cards gain a small health dot — healthy, restarting, unhealthy, stopped-by-policy — with a tooltip explaining the current state. It is a dot, not a badge: the desktop should not turn into a dashboard of alarms.
- A 24-hour restart sparkline in the app panel makes a crash loop visible at a glance.
- A **Recovery history** list shows what the watchdog did and when, so an automatic action is never invisible.
- A per-app **Mute for 24 h** control, because the first thing anyone wants when debugging is for the watchdog to stop interfering.

**Feature scope**

- Watchdog observes container state transitions and applies the configured policy.
- Restart-loop detection: N restarts inside a rolling window triggers a notification through the existing pipeline, and optionally stops the app instead of letting it thrash.
- Optional recovery actions beyond restart: pull the latest image and recreate, or run an existing scheduled task.
- Docker `HEALTHCHECK` results are surfaced where the image defines one, instead of inferring health from the process alone.

**Data & API**

- A new `app_health` table: `app_id` (PK), `policy` (jsonb), `state`, `restart_count`, `window_started_at`, `last_transition_at`, `muted_until`. The `apps` table is left untouched.
- New routes under `/api/v1/apps/[id]/health`; the existing app routes are unchanged.

**Stability**

- **The watchdog never fights the user.** A container stopped manually stays stopped; policy only applies to unexpected exits.
- It never fights an operation either: it checks the `activeOperationsByApp` guard and stands down during an install, update, or uninstall.
- Exponential backoff between restart attempts, with a hard ceiling, so a container that cannot start does not spin the Docker daemon.
- Disabled per app by default, and killable globally with `HOMEIO_AUTOHEAL=false` — the escape hatch if a policy misbehaves in the field.

**Performance**

- One subscription to the Docker event stream for the whole system, not a poll per app. Falls back to a 30-second inspect poll only when the event stream is unavailable.
- State is held in memory with debounced writes, following the bounded-memory pattern established by the v1.7 `latestOperationEvent` fix — the map is keyed by installed app and cannot grow without bound.

**Done when** — an app killed with `docker kill` comes back under an `on-failure` policy; a container that crash-loops is stopped and notified after the budget; a manually stopped app is left alone; with every policy off, container behaviour is byte-for-byte what v1.7 does.

---

### Track 4 — Home Assistant Integration ⏸ Tokens shipped, component paused

*The Homeio side is complete and on `v2.0`: scoped API tokens, and a `/api/v1/system/summary` aggregate cached for five seconds. The Home Assistant component itself is paused as of 2026-08-30, pending a decision on whether it lives in its own HACS-installable repository (recommended, since HACS installs from a repository root) or under `apps/` here.*

Home Assistant is where the homelab audience already lives. This track ships the API-token layer first (previously scoped for v2.0's multi-user work, pulled forward because it stands alone) and then a custom component that consumes it — so the tokens land with a real client instead of shipping into a vacuum.

**API tokens**

- New `api_tokens` table: `id`, `name`, `token_hash` (scrypt, matching the existing password hashing), `prefix` (first 8 chars, for display), `scopes` (jsonb), `expires_at`, `last_used_at`, `last_used_ip`, `created_at`, `revoked_at`.
- `Authorization: Bearer <token>` accepted on `/api/v1` routes. The check runs **after** the existing session-cookie check, so browser traffic takes an unchanged path and the cookie remains the only credential the web UI uses.
- Scopes: `read:metrics`, `read:apps`, `write:apps`, `read:files`, `write:files`, `system:power`. Nothing is granted by default; `system:power` requires a separate confirmation at creation.

**UI design**

- **Settings → Security → API tokens**: create, list, revoke. The token value is shown exactly once, in a copy-to-clipboard field with a "you will not see this again" warning, matching how 2FA backup codes are already presented.
- The list shows name, prefix, scopes as chips, last used (relative), and last source IP. Unused tokens older than 90 days are flagged.
- A **Connect Home Assistant** helper renders the base URL, a fresh scoped token, and a QR code for pairing.

**The Home Assistant custom component**

- HACS-installable integration with a config flow: host plus token, validated against `/api/v1/system/summary` before the entry is created.
- Entities: CPU %, memory %, per-mount disk %, CPU temperature, uptime, Homeio version; per-app state sensors and start/stop switches; an update entity when an app update is available.
- A `DataUpdateCoordinator` polling a **single aggregate endpoint** on a 30-second interval — one HTTP request per cycle regardless of how many entities exist.
- Homeio notifications surface as Home Assistant events so users can automate on them.

**Stability**

- Revocation is immediate: a small in-memory cache of validated tokens carries a short TTL and is invalidated on revoke.
- Token attempts reuse the login rate limiter, and failures return the same `{error, code}` envelope as every other auth failure, so nothing new leaks.
- The v1.7 architecture test is extended to recognise bearer-token auth as a valid authentication path — it must keep failing any route with *no* auth at all.

**Performance**

- The aggregate endpoint is cached for five seconds, so ten HA instances polling do not multiply into ten system scrapes.
- Tokens are never validated with a per-request scrypt over the full table: the `prefix` column indexes the lookup to one row before hashing.

**Done when** — a scoped token reads metrics and is refused on power endpoints; revoking a token breaks the next request; the HA integration configures via UI and populates entities; the browser session path is provably unchanged.

---

### Track 5 — Expose Apps over Tailscale ❌ Dropped from v2.0

*Cut on 2026-08-30 to concentrate the release on the Home Assistant integration and the mobile app. Nothing shipped depends on it. The design below stands if it returns in a later release.*

The full nginx-plus-ACME reverse proxy is a large project with a lot of 3 a.m. failure modes, and it moves to v2.1. Tailscale already ships in Homeio and already issues valid HTTPS certificates with no port forwarding, no DNS, and no renewal cron — so the fast path to "reach my apps securely" is `tailscale serve`.

**UI design**

- **Expose** appears in the app card context menu and opens a sheet with two clearly separated choices: **Tailnet only** (visible to your devices) and **Public** (visible to the internet, via Funnel).
- Tailnet-only is the default and styled as the safe path. Public is behind a red confirmation that names the app, the URL, and what will be reachable — and requires 2FA to be enabled on the account first.
- The app's port is auto-detected from its compose file, with an override for multi-port apps.
- On success the sheet shows the final `https://` URL with copy button and QR code — the QR is the same component used by the wizard and the mobile pairing flow.
- **Settings → Network → Remote access** lists every exposure with its type, target app, URL, and an on/off toggle.

**Feature scope**

- Writes exposures through `tailscale serve --bg`, persisting each mapping so it can be reconciled after a restart.
- Per-exposure enable/disable without deleting.
- Certificate status pulled from Tailscale and shown alongside each exposure.
- Uninstalling an app removes its exposure automatically — no orphans.

**Data & API**

- New `tailscale_exposures` table: `id`, `app_id`, `mode` (`serve` / `funnel`), `target_port`, `path`, `url`, `enabled`, `created_at`. The existing `settings` Tailscale columns are untouched.

**Stability**

- Homeio never edits nginx config or host firewall rules for this feature — the blast radius is limited to Tailscale's own state.
- When `tailscaled` is missing or down, the feature disables itself and reuses the existing `missing_tun` and `service_unavailable` states shipped in v1.6 rather than inventing new error handling.
- Reconciliation on boot is idempotent: existing exposures are verified, not blindly recreated.
- Funnel is opt-in per exposure and never inherited from a previous setting.

**Performance**

- Homeio is not in the data path — Tailscale proxies the traffic. Homeio only writes configuration and reads status.
- Status is read on the existing Tailscale status poll; this track adds no new poller and no new background loop.

**Done when** — an app is reachable at a valid HTTPS tailnet URL in under 30 seconds from one click; exposures survive a container restart; uninstalling the app removes the exposure; with no exposures configured, v1.6 Tailscale behaviour is unchanged.

---

### Track 7 — Phone UI (`/m`) 🚧 In progress

> *A phone screen, not a shrunken desktop.*

The desktop shell is a desktop metaphor — windows, a dock, drag-to-move, a command palette —
and it does not shrink into a phone. Rather than thread breakpoints through the window
manager and every panel, which is the riskiest possible change for existing desktop users,
the phone gets its own route in the same app.

`/m` shares the session cookie, the API and the hooks, and leaves the desktop shell
untouched. The mobile launcher navigates there and falls back to `/` when a server does not
serve it, so an older server keeps working.

**What belongs on a phone:** system status at a glance, the monitor (CPU and memory history,
disk, load, containers), the app list with start/stop/restart and a tap to open an app, file
browsing with download and upload, and the terminal.

**What does not:** the app store, disk manager, compose editor, scheduled tasks, and settings
beyond the essentials. A "Desktop view" link covers the rare case where someone needs one of
them from a phone.

---

### Track 6 — Mobile App v2

v1.7.24 shipped the preview: a Connect screen that probes `/api/health` and hands the WebView to the server's own origin. That architecture is correct and does not change — this track makes it feel like a real app.

**UI design**

- A **server list** replacing the single-server Connect screen: nickname, address, a live status dot, swipe to delete, reorder. Most people have one server today and two within a year.
- Native splash screen and app icon; the launcher chrome follows the system light/dark setting and matches Homeio's palette.
- Purposeful error states instead of a blank WebView: tailnet not connected, server unreachable, wrong port, certificate error — each with the actual next step, not a stack trace.
- QR pairing: scan the code produced by the setup wizard (Track 1) to add a server without typing a tailnet address on a phone keyboard.
- Optional biometric lock on the launcher itself. This gates the app, not the Homeio session — the server's own login remains the only authentication.

**Feature scope**

- Android hardware back button maps to WebView history, then to the server list.
- Correct handling of downloads and file uploads from inside the WebView, including the camera picker.
- Home-screen shortcuts that deep-link straight to Terminal or Files on the last-used server.
- Proper safe-area and notch handling; keyboard avoidance in the terminal.

**Stability**

- No credentials are stored by the app — unchanged, and worth restating in the store listing because it is the first question every self-hoster asks.
- The WebView origin allowlist is restricted to configured servers; navigation elsewhere opens the system browser instead.
- TLS errors are never silently accepted, on any build.
- The app must keep working against a v1.7 server: it is a shell, and it may not assume v2.0 endpoints exist.

**Performance**

- Cold start to the server list under 1.5 s on mid-range Android; the list renders from local storage before any health probe returns.
- Health probes run in parallel with a short timeout so one dead server does not block the list.
- Pull-to-refresh is disabled inside the desktop shell to stop it fighting the app's own scroll gestures.

**Release**

- Signed APK attached to GitHub Releases; iOS via TestFlight or a local Xcode build, since App Store review for a self-hosted client needs its own conversation.

**Done when** — two servers can be added, one by QR; the app opens the desktop shell on both; killing the tailnet produces a real error screen rather than a white page; the app still works unchanged against a v1.7.24 server.

---

## v2.1 — Exposure, Observability & Docker Power Tools

> *The work originally scoped for v1.8. It follows v2.0 rather than preceding it.*

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

### Metrics History

System and container metrics have always been real-time only. v2.1 persists them:

- CPU, memory, disk I/O, and network throughput sampled every 30 seconds and stored in PostgreSQL with configurable retention (default 30 days)
- Per-container CPU and memory history alongside existing real-time stats
- CPU temperature and drive temperatures (from v1.7's sensor and SMART integration) included in the time-series — spot thermal spikes correlated with load
- Time-range selector on all monitor graphs: Last 1 h / 6 h / 24 h / 7 d / 30 d
- Automatic data pruning — a scheduled task trims rows older than the retention window; no manual cleanup needed

### Docker Image Manager

Today Homeio manages apps at the compose level. v2.1 adds direct image control:

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

### File Manager Enhancements

Smaller quality-of-life additions deferred from earlier releases:

- **Zip / unzip** — compress a selection of files or folders into a `.zip` archive; extract `.zip`, `.tar.gz`, and `.tar` archives in place
- **Bulk rename** — rename multiple selected files with a find-and-replace pattern or sequential numbering
- **Batch delete** — multi-select delete with a single confirmation prompt instead of one confirmation per file
- **3-part Docker port spec fix** — `applyWebUiPortOverride` now handles `IP:HOST:CONTAINER` mappings (e.g. `0.0.0.0:8080:80`) correctly instead of silently leaving them unchanged

---

---

## v2.2 — Multi-User & Access Control

> *Homeio for shared servers — families, flatmates, teams.*

This is the largest architectural change on the roadmap: every file-manager root, app, and session in Homeio assumes a single user today. It ships after v2.0 and v2.1, on top of the API-token auth layer delivered in v2.0 Track 4.

### Multi-User with Role-Based Access

Today Homeio is single-user by design. v2.2 opens this up:

| Role | Capabilities |
|------|--------------|
| **Admin** | Full access — installs, deletes, settings, power control |
| **User** | Manage own files, launch apps, view metrics — no installs or system changes |
| **Viewer** | Read-only — metrics dashboard, file browsing only |

- Admins invite users by username; registration re-opens for the duration of the invite
- Per-app access control: admins can restrict specific apps to specific users
- Each user has isolated file manager roots (optional — configurable by admin)

### Two-Factor Authentication — Admin Enforcement

Single-user TOTP shipped in v1.7.23. v2.2 extends it for teams:

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

- **Mobile-optimised layout** — the current UI is desktop-first. A native shell for Android and iOS shipped in preview in v1.7.24 ([doctor-io/homeio-mobile](https://github.com/doctor-io/homeio-mobile), reaches the server over Tailscale), but it renders the same desktop-first web app; a responsive layout for the most common actions is still open.
- **ARMv7 (32-bit Pi 2/3)** — blocked on `@lydell/node-pty` publishing an `armv7` prebuilt; building from source on 1 GB hardware that already strains under Postgres + Node + Docker is a poor trade. Parked unless there is real demand.
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
- **Not a cloud service** — everything runs locally; no Homeio cloud accounts, no data leaves your server. The one exception is a single anonymous startup ping (instance UUID, version, arch, OS platform) documented in the [README](./README.md#telemetry) and disabled with `HOMEIO_TELEMETRY=false`.

---

*Updated August 2026 · [Open an issue](https://github.com/doctor-io/homeio/issues) to suggest a feature or report a problem*
