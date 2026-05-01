# PROJECT_AUDIT.md — Homeio Codebase Audit

**Audit date:** 2026-05-01
**Auditor:** Claude Code (claude-sonnet-4-6)
**Working directory:** `/Users/ahmedtabib/Code/home-server`
**Git branch:** `feature/v1.6`

---

## 1. Project Overview

### Identity

| Field | Value |
|---|---|
| Name | `homeio` |
| Version | `1.6.1` |
| Description | Self-hosted home server dashboard — desktop-style UI for managing Docker apps, files, terminal, and system resources |
| License | MIT |
| Author | doctor-io |
| Homepage | https://github.com/doctor-io/homeio |
| Node requirement | 22.x (declared in README, Dockerfile uses `node:22-alpine`) |
| Package manager | npm (package-lock.json present) |

### Scripts

| Script | Purpose |
|---|---|
| `dev` | `node --import tsx server.ts` — run dev server with TypeScript transpiled on-the-fly |
| `dev:website` | Launches the companion homeio-website project on port 3100 |
| `build` | `next build && npm run build:server` — builds Next.js app then compiles server-only code |
| `build:server` | `tsc -p tsconfig.server.json && tsc-alias -p tsconfig.server.json` — emits `dist-server/` |
| `start` | `NODE_ENV=production node dist-server/server.js` — production start |
| `lint` | `eslint .` |
| `test` | `vitest run` |
| `test:coverage` | `vitest run --coverage` |
| `test:watch` | `vitest` (watch mode) |
| `prepare` | `husky` — sets up git hooks |
| `db:init` | `tsx ./scripts/db-migrate.ts` — runs migrations, resetting the migration table first |
| `db:reset` | `tsx ./scripts/db-reset.ts` — destructive database reset |
| `db:generate` | `drizzle-kit generate` — generate migration SQL from schema diff |
| `db:migrate` | `drizzle-kit migrate` — apply pending migrations |

### Production Dependencies (all)

| Package | Purpose |
|---|---|
| `@dawudesign/node-hexa-cli` ^0.7.6 | Unclear — not visibly used in audited code; likely a utility CLI package |
| `@fluentui/react-icons` ^2.0.321 | Microsoft Fluent icon set used extensively throughout the UI |
| `@hookform/resolvers` ^3.9.1 | Zod/Yup adapters for react-hook-form |
| `@lydell/node-pty` ^1.2.0-beta.3 | Pseudo-terminal (PTY) for the terminal feature — spawns bash/docker exec sessions |
| `@radix-ui/react-*` (26 packages) | Headless UI primitives (accordion, dialog, dropdown, tooltip, etc.) — shadcn/ui foundation |
| `@tanstack/react-query` ^5.95.0 | Client-side data fetching, caching, and server state synchronisation |
| `@types/js-yaml` ^4.0.9 | TypeScript types for js-yaml (oddly in production deps, not devDependencies) |
| `@vercel/analytics` 1.6.1 | Vercel analytics — unlikely to fire since not deployed on Vercel; potentially a remnant |
| `autoprefixer` ^10.4.27 | CSS vendor prefix injection for Tailwind |
| `class-variance-authority` ^0.7.1 | CVA for component variant management |
| `clsx` ^2.1.1 | Conditional className utility |
| `cmdk` 1.1.1 | Command palette component (used for `⌘K`) |
| `compression` ^1.8.1 | HTTP response compression middleware for the custom Node.js server |
| `date-fns` 4.1.0 | Date formatting and manipulation |
| `dbus-next` ^0.10.2 | D-Bus bindings — used in the dbus-helper sidecar for NetworkManager integration |
| `drizzle-orm` ^0.45.1 | ORM for PostgreSQL queries and schema definition |
| `embla-carousel-react` 8.6.0 | Carousel component (part of shadcn/ui) |
| `input-otp` 1.4.2 | OTP input component (shadcn/ui) |
| `js-yaml` ^4.1.1 | YAML parsing for Docker Compose file handling |
| `next` ^16.2.1 | Next.js App Router — full-stack React framework |
| `next-themes` ^0.4.6 | Theme/dark-mode management |
| `openmeteo` ^1.2.3 | Open-Meteo weather API client — used for weather widget |
| `pg` ^8.20.0 | PostgreSQL client for Node.js (drizzle-orm uses this) |
| `react` 19.2.4 | React 19 — latest version |
| `react-day-picker` ^9.14.0 | Date picker component (shadcn/ui) |
| `react-dom` 19.2.4 | React DOM renderer |
| `react-hook-form` ^7.72.0 | Form state management |
| `react-resizable-panels` ^2.1.7 | Resizable panel layout component |
| `recharts` 2.15.0 | Chart library for system metrics graphs |
| `server-only` `file:packages/server-only` | Local package that throws at build time if imported on the client — boundary enforcement |
| `sonner` ^1.7.1 | Toast notification library |
| `systeminformation` ^5.31.5 | System info (CPU, memory, disk, network stats) via Node.js |
| `tailwind-merge` ^3.3.1 | Merges conflicting Tailwind classes intelligently |
| `vaul` ^1.1.2 | Drawer/sheet component (shadcn/ui) |
| `ws` ^8.20.0 | WebSocket server for terminal feature |
| `xterm` ^5.3.0 | Browser-side terminal emulator |
| `xterm-addon-fit` ^0.8.0 | xterm addon — resizes terminal to container |
| `xterm-addon-web-links` ^0.9.0 | xterm addon — clickable links in terminal output |
| `zod` ^3.24.1 | Schema validation used everywhere (env, API payloads, forms) |

**Notable misplacement:** `@types/js-yaml` is in `dependencies` (not `devDependencies`). Type packages belong in `devDependencies`.

**Potentially unused:** `@vercel/analytics` — the project is self-hosted and not deployed to Vercel. No evidence of it being configured in layout.tsx.

**Potentially unused:** `@dawudesign/node-hexa-cli` — not seen in any audited code file.

### Dev Dependencies (all)

| Package | Purpose |
|---|---|
| `@tailwindcss/postcss` ^4.2.2 | PostCSS plugin for Tailwind v4 |
| `@testing-library/dom` ^10.4.1 | DOM testing utilities |
| `@testing-library/jest-dom` ^6.9.1 | jest-dom matchers |
| `@testing-library/react` ^16.3.2 | React component testing |
| `@types/compression` ^1.8.1 | TypeScript types for compression middleware |
| `@types/d3-color` ^3.1.3 | TypeScript types for d3-color (recharts transitive dep) |
| `@types/d3-path` ^3.1.1 | TypeScript types for d3-path (recharts transitive dep) |
| `@types/node` ^22 | Node.js TypeScript types |
| `@types/pg` ^8.20.0 | PostgreSQL client TypeScript types |
| `@types/react` 19.2.14 | React TypeScript types |
| `@types/react-dom` 19.2.3 | React DOM TypeScript types |
| `@types/ws` ^8.18.1 | WebSocket TypeScript types |
| `@vitest/coverage-v8` ^4.1.0 | V8-based coverage for Vitest |
| `drizzle-kit` ^0.31.10 | Drizzle migration CLI |
| `drizzle-seed` ^0.3.1 | Database seeding utility |
| `eslint` ^9.39.4 | Linting |
| `eslint-config-next` ^16.2.1 | Next.js ESLint config |
| `husky` ^9.1.7 | Git hooks manager |
| `jsdom` ^28.1.0 | DOM implementation for tests |
| `postcss` ^8.5 | CSS transformation |
| `tailwindcss` ^4.2.2 | Tailwind CSS v4 |
| `tsc-alias` ^1.8.16 | Resolves TypeScript path aliases in compiled output |
| `tsx` ^4.21.0 | TypeScript execution (dev server, scripts) |
| `tw-animate-css` 1.3.3 | Tailwind animation utilities |
| `typescript` 5.7.3 | TypeScript compiler |
| `vitest` ^4.0.18 | Test runner |

---

## 2. Tech Stack & Architecture

### Frontend

- **Framework:** Next.js 16.2.x (App Router) with React 19.2.4
- **UI system:** shadcn/ui components built on Radix UI primitives with Tailwind CSS v4
- **Styling:** Tailwind CSS v4 with OKLCH color tokens and custom CSS variables for glass-morphism
- **State management:** TanStack Query v5 for server state; `useReducer` for complex local state (file manager); `useState` for simple component state; `localStorage` for persistence of lock state and recent actions
- **Charts:** Recharts 2.15.0
- **Terminal:** xterm.js with xterm-addon-fit and xterm-addon-web-links
- **Forms:** react-hook-form + Zod via @hookform/resolvers
- **Notifications:** Sonner toasts

### Backend

- **Framework:** Next.js App Router API routes (`app/api/`) for HTTP endpoints; Server Actions for some mutations
- **Custom server:** `server.ts` — a raw Node.js `http.createServer` that wraps the Next.js request handler, adds gzip compression, and initialises the WebSocket server
- **Runtime:** Node.js 22.x
- **Real-time:** Server-Sent Events (SSE) for metrics streaming and notifications; WebSockets for terminal (node-pty)
- **Sidecar process:** `services/dbus-helper/` — a separate Node.js process that communicates with NetworkManager via D-Bus over a Unix domain socket

### Database

- **PostgreSQL** 16 (Docker image: `postgres:16-alpine`)
- **ORM:** Drizzle ORM with `drizzle-orm/node-postgres`
- **Migration strategy:** `drizzle-kit push` at container startup (via `docker-entrypoint.sh`); migration files stored in `drizzle/`
- **Schema tables:** `apps`, `users`, `sessions`, `app_stacks`, `app_operations`, `custom_store_apps`, `files_network_shares`, `files_local_shares`, `notifications`, `scheduled_tasks`, `scheduled_task_executions`, `settings`, `files_google_drive_tokens`, `files_trash_entries`

### Authentication

- Custom session token: HMAC-SHA256 signed `{sessionId}.{expiresAtEpochSeconds}.{signature}` stored in an `httpOnly` cookie named `homeio_session`
- Password hashing: Node.js `crypto.scrypt` with a random 16-byte salt; no bcrypt/argon2
- Session TTL: configurable via `AUTH_SESSION_HOURS` (default 168 hours = 7 days)

### Build

- **Next.js build** produces `.next/standalone/` when `NEXT_OUTPUT=standalone`
- **Server-only build** via `tsc -p tsconfig.server.json` outputs to `dist-server/`; path aliases resolved by `tsc-alias`
- **Docker:** Multi-stage build (deps → builder → runner); 3 stages; final image runs as non-root user `homeio:1001`

### Testing

- **Runner:** Vitest ^4.0.18
- **Coverage:** V8 provider via `@vitest/coverage-v8`
- **Environments:** `node` (default, for server modules); JSDOM mocked for components
- **Setup:** `test/setup.ts` mocks `server-only`, `EventSource`, and `window.matchMedia`

### Linting/Formatting

- **ESLint 9** flat config (`eslint.config.mjs`) using `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Key rules: `no-console: off`, `@typescript-eslint/no-explicit-any: warn`, `@typescript-eslint/no-unused-vars: warn`
- **No Prettier or Biome config** found. Formatting is not enforced.
- **Husky** with `lint-staged`: runs `eslint --fix` on staged `*.{js,jsx,ts,tsx}` files
- **Bug:** `lint-staged` config has a space in the glob: `"*.{js, jsx,ts,tsx}"` — the space after the comma means `*.{ jsx}` is a separate (broken) pattern. The `jsx` and `js` files may not lint-stage correctly.

### TypeScript

- **`tsconfig.json`:** strict mode enabled, `noEmit: true`, `moduleResolution: bundler`, path alias `@/*` → root
- **`tsconfig.server.json`:** extends base, `noEmit: false`, emits to `dist-server/`, CommonJS output (`module: commonjs`), `target: ES2022`
- **`ignoreBuildErrors: true`** in `next.config.mjs` — TypeScript errors do not fail the production build. This is a significant quality risk.

---

## 3. Folder Structure

```
/Users/ahmedtabib/Code/home-server/
├── app/                    Next.js App Router pages and API routes
│   ├── api/
│   │   ├── auth/           Login, logout, register, me, unlock endpoints
│   │   └── v1/             Versioned API routes
│   │       ├── apps/       App management APIs + SSE log stream
│   │       ├── files/      File CRUD, download, upload, trash, stars, shares
│   │       ├── notifications/  Notification list + SSE stream
│   │       ├── store/      App store catalog, install/update/uninstall actions
│   │       ├── system/     Metrics snapshot + SSE stream, network, power
│   │       └── tasks/      Scheduled tasks CRUD + executions
│   ├── login/              Login page
│   ├── register/           Registration page
│   ├── globals.css         Global CSS with design tokens
│   └── layout.tsx          Root layout with providers
├── components/             Shared UI components
│   ├── auth/               Login and register forms
│   ├── icons/              Custom SVG icon components (file-icons, platform-icons)
│   ├── providers/          AppProviders, RealtimeBootstrap, ThemeProvider
│   └── ui/                 shadcn/ui generated component library (button, dialog, etc.)
├── drizzle/                SQL migration files
├── hooks/                  Global React hooks (useCurrentUser, useDebouncedValue, etc.)
├── lib/
│   ├── desktop/            Client-side persistence helpers (lock-state, reboot-state, recent-actions)
│   ├── server/             Server-only code (imported with "server-only" guard)
│   │   ├── cache/          LruCache<T> implementation
│   │   ├── db/             Drizzle client setup and schema (schema.ts, drizzle.ts)
│   │   ├── http/           Graceful shutdown utility
│   │   ├── logging/        Structured logger with file and console sinks
│   │   ├── modules/
│   │   │   ├── apps/       App service, operations, stacks repository, store catalog
│   │   │   ├── auth/       Auth service, password, session token, cookies, repository
│   │   │   ├── docker/     Compose parser, compose runner (1400+ lines), logs, ownership
│   │   │   ├── files/      File service (900+ lines), path resolver, stars, trash, network shares
│   │   │   ├── network/    D-Bus helper client, network service
│   │   │   ├── notifications/ Notification service, emitter (in-memory pub/sub)
│   │   │   ├── store/      Store catalog, custom apps, update-check
│   │   │   ├── system/     System metrics service (CPU, memory, disk, network)
│   │   │   ├── tasks/      Scheduled task runner and cron service
│   │   │   ├── terminal/   WebSocket terminal server (PTY)
│   │   │   └── usb/        USB drive detection and mount via D-Bus
│   │   ├── realtime/       SSE utility (toSseChunk)
│   │   └── storage/        Data root path resolution
│   ├── shared/             Code shared between client and server
│   │   ├── auth/           Session token parsing (client-safe)
│   │   ├── contracts/      TypeScript type contracts for all API shapes
│   │   ├── feature-flags.ts  Static feature flag object (GOOGLE_DRIVE: false)
│   │   ├── query-keys.ts   TanStack Query key factory
│   │   └── store-operations.ts  Operation status helpers
│   └── ui/
│       ├── surface-tokens.ts   Glass-morphism CSS class string constants
│       └── utils.ts / lib/utils.ts  cn() utility
├── modules/                Feature modules (co-located components + hooks)
│   ├── apps/               App Grid, App Store, configurator, logs, hooks
│   ├── files/              File Manager (browser, preview, editor, sidebar, toolbar)
│   ├── settings/           Settings panel with all settings sections
│   ├── shell/              Desktop shell, dock, window, command palette, lock screen, terminal
│   └── system/             System monitor, status bar, network manager, notifications panel, widgets
├── packages/
│   └── server-only/        Local package: exports nothing but enforces server-only import boundary
├── public/                 Static assets (wallpapers, icons, screenshots)
├── scripts/                Shell scripts (install.sh, update.sh, uninstall.sh, factory-reset.sh) + DB scripts
├── services/
│   └── dbus-helper/        Standalone Node.js sidecar for D-Bus / NetworkManager integration
├── test/
│   └── setup.ts            Vitest global setup file
├── .env.example
├── docker-compose.yml
├── docker-entrypoint.sh
├── Dockerfile
├── drizzle.config.ts
├── eslint.config.mjs
├── next.config.mjs
├── package.json
├── server.ts               Custom Node.js HTTP server entry point
├── tsconfig.json
├── tsconfig.server.json
└── vitest.config.ts
```

### Per-Top-Level Folder Explanations

- **`app/`** — Next.js App Router. Pages are minimal shells; all logic lives in `modules/`. API routes follow RESTful patterns under `api/v1/`. Auth routes live under `api/auth/`.
- **`components/`** — Pure shared UI. `ui/` is a shadcn/ui component library. `icons/` contains custom SVG icons. `providers/` contains React context providers.
- **`drizzle/`** — SQL migration files generated by drizzle-kit.
- **`hooks/`** — Global client hooks not tied to a specific module (useCurrentUser, useDebouncedValue, useDesktopPreferences).
- **`lib/`** — Core logic library split into `server/`, `shared/`, and `ui/`. The `desktop/` subfolder holds localStorage access helpers.
- **`modules/`** — Feature-vertical slices. Each module owns its UI components, hooks, and module-local types.
- **`packages/`** — Local npm workspace package. Only `server-only` is present; it exists solely to enforce import boundaries.
- **`public/`** — Static files (wallpapers at `/public/images/`, icons).
- **`scripts/`** — Installation and database management scripts.
- **`services/dbus-helper/`** — A standalone Node.js process written in plain JS (ESM `.mjs` files). Communicates with the main app via a Unix socket.
- **`test/`** — Test infrastructure only. No test files live here; tests are co-located.

### Organizational Issues

1. **`lib/utils.ts` vs `lib/ui/utils.ts`** — there appear to be two utility files. The `cn()` function is imported from `@/lib/utils`; it should be verified that both are not duplicating content.
2. **`lib/desktop/` inside `lib/`** — client-only localStorage helpers live under `lib/`, which also contains `lib/server/`. A developer might assume `lib/` is server code. These could move to `lib/client/` for clarity.
3. **No `middleware.ts`** — there is no Next.js middleware for auth protection. Route protection relies entirely on each API route calling `authenticateSession()` individually, and the client checking `/api/auth/me` on load. This means unauthenticated requests to non-auth API routes are only rejected at the handler level — there is no centralised edge-level guard.
4. **`services/dbus-helper/` in root** — this sidecar is plain JavaScript (`.mjs`) while everything else is TypeScript. It is not part of the main build pipeline.

---

## 4. Features Inventory

### Desktop UI / Shell
- **Location:** `modules/shell/components/` — `desktop-shell.tsx` (955 lines), `dock.tsx`, `window.tsx`, `lock-screen.tsx`, `terminal.tsx`, `command-palette.tsx`, `status-bar/`, `reboot-overlay.tsx`, `update-recovery-screen.tsx`
- **Structure:** `DesktopShellInner` is a single large component that manages all window state (open/close/minimize/focus), wallpaper fade transitions, keyboard shortcuts (`⌘K`, `⌘L`), and renders all windows inline. Windows are windowed UI panels rendered as positioned divs, not native windows.
- **Issues:** `desktop-shell.tsx` at 955 lines is the largest UI file and manages too many concerns — wallpaper transitions, window z-index, lock state, reboot state, keyboard shortcuts, all logout/unlock logic, and command palette interactions all live in one component. Window state management (openWindows, closingWindows, minimizedWindows, focusedWindow) uses 4 separate `useState` arrays that must stay in sync — a potential source of subtle bugs.

### App Grid
- **Location:** `modules/apps/components/` — `app-grid.tsx`, `app-grid-controller.ts`, `app-grid-content.tsx`, `app-grid-menu.tsx`, `app-grid-presenters.ts`
- **Structure:** Decomposed into controller + view. The grid displays installed apps with real-time status polling via TanStack Query. Context menu actions trigger store operations (start/stop/restart/logs/settings).
- **Issues:** Hardcoded demo app data in `lib/server/modules/apps/service.ts` (8 apps with hardcoded CDN icon URLs) with no interface for customising demo mode content.

### App Store
- **Location:** `modules/apps/components/app-store.tsx` + `lib/server/modules/store/`
- **Structure:** Catalog fetched from a configurable remote URL (default: big-bear-portainer templates.json). Custom apps stored in DB. Install/update/uninstall run as async operations with SSE progress streaming. Operations are in-process (Node.js), not queued to a worker.
- **Issues:** Operations run directly in the Next.js server process using `queueMicrotask`. Long-running operations (image pulls) block resources but are non-blocking to the caller. There is no operation queue limit — many concurrent installs are possible.

### Terminal
- **Location:** `modules/shell/components/terminal.tsx` (client), `lib/server/modules/terminal/websocket-server.ts`
- **Structure:** WebSocket server attaches to the same HTTP server as Next.js. PTY spawned per session using `@lydell/node-pty`. Supports container attachment (`docker exec`), idle timeout (default 15 min), lifetime limit (1 hour), and max sessions per user (default 2). Environment variables are explicitly allowlisted — secrets are not forwarded to the PTY.
- **Issues:** The README mentions "command allowlist" but the WebSocket terminal is a full bash shell, not restricted. The command allowlist applies to a different (simpler) terminal mode. This distinction is not documented in the code.

### File Manager
- **Location:** `modules/files/` — `components/manager/` (file-manager.tsx, file-manager-state.ts, file-manager-derived.ts, file-manager-actions.ts, file-manager-keyboard.ts, file-manager-view.tsx), `components/chrome/` (sidebar, toolbar, status-bar), `components/content/`, `hooks/useFiles.ts`, plus server at `lib/server/modules/files/service.ts`
- **Structure:** State managed by a `useReducer` with a large `FileManagerState` type (26 fields). Logic is well-decomposed into derived data functions (`file-manager-derived.ts`), action hooks, keyboard handler, and view component. Server service handles all FS operations with path jail (`resolvePathWithinFilesRoot`).
- **Issues:** `file-manager-state.ts` has 26 state fields — complex but manageable given the feature richness. `getCurrentEntries` in `file-manager-derived.ts` has parameters typed as `unknown[]` instead of `FileListEntry[]`.

### Network Manager
- **Location:** `modules/system/components/status-bar/wifi-popover.tsx`, `lib/server/modules/network/`, `services/dbus-helper/`
- **Structure:** The main app communicates with the dbus-helper sidecar over a Unix domain socket using a JSON-RPC-like protocol. The sidecar uses `dbus-next` to call NetworkManager D-Bus APIs. Events (connect/disconnect) are broadcast to all connected sockets.
- **Issues:** The dbus-helper is plain JavaScript (no TypeScript), making it an island with no type safety. It must be started separately from the main app and is not auto-started in the Node.js server code — only in the bare-metal install scripts.

### System Metrics
- **Location:** `lib/server/modules/system/service.ts`, `app/api/v1/system/stream/route.ts`, `app/api/v1/system/metrics/route.ts`
- **Structure:** Uses `systeminformation` library. Results are cached in an `LruCache` with TTL configurable via `METRICS_CACHE_TTL_MS`. Published via SSE every `METRICS_PUBLISH_INTERVAL_MS`. Client hooks via `useSystemSse` which pushes directly into TanStack Query cache using `queryClient.setQueryData`.
- **Issues:** The SSE stream does not respect authentication — any client that opens `/api/v1/system/stream` receives live metrics. The same is true for `/api/v1/notifications/stream`.

### Authentication
- **Location:** `lib/server/modules/auth/`, `app/api/auth/`
- **Structure:** Cookie-based sessions with HMAC-SHA256 signed tokens. Password hashing uses `scrypt` (not bcrypt/argon2). `httpOnly` + `sameSite: lax` cookie. Secure flag auto-set when request arrives over HTTPS. Single-user mode — registration closes after first setup.
- **Issues:** No rate limiting on login attempts. No account lockout. No brute force protection. The `authenticateSession` function is called per-request individually in each handler — no centralised middleware. The `passwordHash` field is returned from `authenticateSession` and included in session objects, which means it circulates in memory on every authenticated request unnecessarily.

### Notifications
- **Location:** `lib/server/modules/notifications/`, `app/api/v1/notifications/`
- **Structure:** Notifications stored in PostgreSQL. In-memory pub/sub via `emitter.ts` (Set of subscribers). SSE stream subscribes to the emitter. Hard cap of 50 notifications in the list query; old rows pruned after insert.
- **Issues:** The in-memory emitter does not survive server restart — notifications created before SSE reconnection are only visible via the initial list load, not re-emitted. This is a known acceptable trade-off for SSE design.

### Scheduled Tasks
- **Location:** `lib/server/modules/tasks/` (inferred from schema and queryKeys), `modules/settings/` (UI)
- **Structure:** Tasks stored in `scheduled_tasks` table with cron expressions. Execution history in `scheduled_task_executions`. A cron runner processes tasks on schedule.
- **Note:** The tasks module directory was not directly readable but its DB schema, contracts, and query keys confirm its existence and structure.

### Settings
- **Location:** `modules/settings/components/` — deeply nested registry/controller pattern
- **Structure:** Settings sections defined in a `registry.ts`. Each section has a controller hook and a section component. Settings backend is accessed via `useSettingsBackend`. Sections: General, Appearance, Updates, Network, Storage, Docker, Scheduled Tasks, Backup, Users, Security, Notifications, Power, Advanced.

### API Endpoints (confirmed routes)

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/me` | GET | Current session info |
| `/api/auth/register` | POST | User registration (first-run only) |
| `/api/auth/unlock` | POST | Verify password for lock screen unlock |
| `/api/v1/apps` | GET | List installed apps |
| `/api/v1/apps/[appId]` | GET/PATCH/DELETE | Individual app operations |
| `/api/v1/apps/[appId]/logs/stream` | GET (SSE) | Real-time container log stream |
| `/api/v1/apps/[appId]/operation` | POST | Start install/update/uninstall |
| `/api/v1/apps/[appId]/operation/[opId]/stream` | GET (SSE) | Operation progress stream |
| `/api/v1/files/*` | GET/POST/PUT/DELETE | File CRUD, browse, download, upload, stars, trash |
| `/api/v1/notifications` | GET/DELETE | List and clear notifications |
| `/api/v1/notifications/stream` | GET (SSE) | Real-time notification stream |
| `/api/v1/store/catalog` | GET | App store catalog |
| `/api/v1/store/apps/[appId]` | GET | App store detail |
| `/api/v1/system/metrics` | GET | Current metrics snapshot |
| `/api/v1/system/stream` | GET (SSE) | Real-time metrics stream |
| `/api/v1/system/network/*` | GET/POST | Network status, WiFi scan, connect/disconnect |
| `/api/v1/system/power/*` | POST | Shutdown, reboot, update |
| `/api/v1/tasks` | GET/POST | Scheduled tasks CRUD |
| `/api/terminal` | WS | WebSocket terminal (upgrade on HTTP server) |

---

## 5. Code Quality Assessment

### Files Over 500 Lines

| File | Approximate Lines | Notes |
|---|---|---|
| `lib/server/modules/docker/compose-runner.ts` | ~1450 | Compose YAML manipulation, storage binding rewriting, Docker CLI wrapping — massive single file |
| `lib/server/modules/apps/operations.ts` | ~1283 | All app lifecycle operations (install/update/uninstall/start/stop/restart) — one large async machine |
| `lib/server/modules/files/service.ts` | ~900+ | File system CRUD, path validation, upload, trash, stars, network mounts |
| `modules/shell/components/desktop-shell.tsx` | 955 | Desktop shell state orchestration — renders all windows |
| `lib/server/modules/system/service.ts` | ~500+ | System metrics collection with multiple caching strategies |
| `modules/files/components/manager/file-manager.tsx` | ~500+ | File manager root component |

### Duplicated Code Patterns

1. **`parseEnvFileContent` / env file parsing exists in at least 3 places:** `drizzle.config.ts`, `scripts/db-migrate.ts`, and `lib/server/modules/docker/compose-runner.ts` all contain their own env file line parser. This is the most glaring duplication — a shared `parseEnvFile(path)` utility would clean this up.

2. **`clampPercent` defined twice:** Once in `lib/server/modules/apps/operations.ts` (line 98) and again in `modules/files/components/manager/file-manager-derived.ts` (line 79). Identical implementations.

3. **SSE stream boilerplate:** The ReadableStream + heartbeat interval + request.signal abort pattern is copy-pasted across `app/api/v1/system/stream/route.ts`, `app/api/v1/apps/[appId]/logs/stream/route.ts`, and `app/api/v1/notifications/stream/route.ts`. The notification stream hardcodes `30_000` for the heartbeat interval while the others use `serverEnv.SSE_HEARTBEAT_MS` — an inconsistency.

4. **`resolveEnvPathFromComposePath` in `operations.ts`** (lines 1007–1013): Both branches of the if/else return identical values — the function body is dead-code.

```typescript
// lib/server/modules/apps/operations.ts:1007
function resolveEnvPathFromComposePath(composePath: string) {
  const composeFileName = path.basename(composePath).toLowerCase();
  if (composeFileName === "docker-compose.yml" || composeFileName === "docker-compose.yaml") {
    return path.join(path.dirname(composePath), ".env");
  }
  return path.join(path.dirname(composePath), ".env"); // identical — dead branch
}
```

### Inconsistent Naming Conventions

- API route files use `route.ts` consistently (good)
- Hook files: some use `useX.ts`, some use `useX.tsx` (minor)
- Server module directories: `apps/`, `auth/`, `docker/` are singular but `notifications/` uses plural. Inconsistent but minor.
- `STORE_STACKS_ROOT` vs `FILES_ROOT` vs `AUTH_SESSION_SECRET` — env var naming is consistent (UPPER_SNAKE_CASE)

### Missing TypeScript Types / `any` Usage

- `getCurrentEntries` in `file-manager-derived.ts` has `directoryEntries: unknown[]`, `globalEntries: unknown[]`, `starredEntries: unknown[]` as parameters. These should be typed `FileListEntry[]`.
- `next.config.mjs` sets `typescript: { ignoreBuildErrors: true }` — this is a blanket suppression of all TypeScript errors during production builds. Any type errors in the codebase are silently ignored at build time.
- ESLint has `@typescript-eslint/no-explicit-any: warn` (not error), meaning `any` usage generates a warning but does not block CI.
- `toRecord` in `lib/server/modules/notifications/service.ts` casts `row.kind as NotificationKind` without validation — if an unknown string is in the DB, it will pass through silently.

### Console.logs in Production Code

The `no-console` rule is set to `off` in ESLint. Console statements are intentional and used extensively as the primary logging mechanism in `server.ts` and several modules. The structured logger in `lib/server/logging/logger.ts` uses `console.log`, `console.warn`, and `console.error` internally. This is intentional design, not a quality issue per se.

### TODO / FIXME / HACK Comments

From reviewed code:
- `lib/server/modules/apps/operations.ts` line 72: `const IS_TEST_ENV = process.env.NODE_ENV === "test" || process.env.VITEST === "true"` — test environment detection baked into production code is a code smell
- `next.config.mjs` has a comment: `// "standalone" is set via NEXT_OUTPUT env var during Docker builds only` — the conditional output mode is a workaround for dev/prod inconsistency
- `modules/shell/components/desktop-shell.tsx` line 278: `// eslint-disable-next-line react-hooks/exhaustive-deps` — a suppressed hook dependency warning

### Dead Code

- `resolveEnvPathFromComposePath` in `operations.ts` has a dead branch (documented above)
- `WEBSOCKET_ENABLED` env var is defined in the schema (`lib/server/env.ts`) and `.env.example` but is not referenced in any audited code — appears unused
- `@vercel/analytics` dependency — not used in any audited files

### Inconsistent Error Handling Patterns

- API routes mix patterns: some use `try/catch` + `NextResponse.json({error})`, others use `withServerTiming` which re-throws. Callers of `withServerTiming` must still catch externally.
- `FileServiceError` and `FilesPathError` are separate error classes for the same domain — `mapFsError` in `service.ts` converts `FilesPathError` → `FileServiceError`, creating a two-layer error hierarchy for one feature.
- Silent swallows: many places use `.catch(() => undefined)` to suppress notification creation errors — acceptable but means notification failures are invisible.

### Mixed Paradigms

- The `services/dbus-helper/` sidecar is plain JavaScript (ESM `.mjs`) while the rest of the project is TypeScript.
- The project uses both Next.js Server Actions (for some mutations) and API routes — the `CONTRIBUTING.md` documents the intended split, but it adds cognitive overhead for contributors who must know which pattern applies where.

### Missing Tests

Test coverage is minimal. From examining `test/setup.ts` and `vitest.config.ts`:
- Tests use Vitest but no actual test files were encountered in the audited directories
- The `scripts/db-migrate.ts` re-drops the migration table on each `db:init` run, which means the migration history is always rebuilt — this is documented as intentional but unusual
- No integration tests, no end-to-end tests, no API route tests found
- Estimated unit test coverage: very low (< 10% of server logic)

### Hardcoded Values That Should Be Config/Env Vars

- `lib/server/modules/apps/service.ts`: CDN URL `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png` is hardcoded
- `lib/server/modules/apps/service.ts`: Demo app list with 8 hardcoded apps
- `app/api/v1/apps/[appId]/logs/stream/route.ts`: `MAX_APP_LOG_CONNECTIONS = 20` is a hardcoded constant (not configurable via env)
- `lib/server/modules/notifications/service.ts`: `MAX_NOTIFICATIONS = 50` is hardcoded
- `app/login/page.tsx`: `process.env.DEMO_MODE === "true"` — direct env access in a page component rather than through the validated `serverEnv` object
- `lib/server/modules/system/service.ts`: Multiple cache TTL constants are hardcoded (`HELPER_STATUS_CACHE_TTL_MS = 10_000`, `WIFI_NETWORKS_CACHE_TTL_MS = 30_000`, etc.)

### Security Concerns

1. **No authentication on SSE streams:** `/api/v1/system/stream` and `/api/v1/notifications/stream` do not verify the session cookie. Any unauthenticated client can subscribe to live system metrics and notifications.

2. **`typescript: { ignoreBuildErrors: true }` in `next.config.mjs`:** A type error that could indicate a logic bug will not fail the build.

3. **Default `AUTH_SESSION_SECRET`:** The default value `"change-me-to-a-random-32-char-secret"` in `docker-compose.yml` is well-known. Users who do not change it are vulnerable to session token forgery. This is documented in the README but not enforced.

4. **HMAC-SHA256 for session tokens instead of a more standard JWT/PASETO:** The custom token format is functional but non-standard. The `parseSessionToken` function splits on `.` — a token with extra dots would parse incorrectly (returns null, which is safe, but the parsing logic is fragile).

5. **`scrypt` for passwords instead of `bcrypt`/`argon2`:** `scrypt` is a legitimate KDF but is less commonly used in web contexts than argon2. The parameters use Node.js defaults which may not be optimally tuned for password hashing.

6. **No rate limiting:** Login endpoint (`/api/auth/login`) has no rate limiting. Brute force attacks on passwords are unrestricted.

7. **`passwordHash` returned from `authenticateSession`:** The hash travels in the session lookup result unnecessarily. It is used only in `verifyUnlockPassword` but the pattern means password hashes circulate in memory on every authenticated API call.

---

## 6. Existing Documentation

| File | Purpose |
|---|---|
| `/README.md` | Complete: install methods, features, security notes, limitations, experimental features, development setup, telemetry disclosure |
| `/ROADMAP.md` | Detailed v1.4/v1.5/v1.6/v2.0 roadmap with feature descriptions |
| `/CONTRIBUTING.md` | Development setup, project structure, API conventions, design system token guide, branch/commit conventions, PR checklist |
| `/LICENSE` | MIT license text |

### What Docs Exist

- User-facing install documentation
- Security notes
- Feature changelog
- Developer setup guide
- Design system guidance (surface tokens)
- API conventions (Server Actions vs. API routes, SSE patterns)

### What Is Missing

- No architecture diagram or component interaction map
- No API reference documentation (no OpenAPI/Swagger)
- No description of the dbus-helper sidecar protocol or how to run it locally during development
- No documentation on how to add a new settings section or new feature module
- No documentation on the scheduled task system (how to add a new task type)
- No security threat model
- No performance tuning guide
- No troubleshooting guide beyond "check docker logs"

---

## 7. Configuration Files

### `tsconfig.json`

- `strict: true` — strict mode enabled
- `noEmit: true` — no JS output from this config (Next.js handles compilation)
- `moduleResolution: bundler` — for Next.js bundler
- `paths: { "@/*": ["./*"] }` — root alias

### `tsconfig.server.json`

- Extends `tsconfig.json`
- `noEmit: false`, `outDir: ./dist-server` — emits compiled JS
- `module: commonjs`, `moduleResolution: node` — Node.js-compatible output
- `target: ES2022`
- Includes only `server.ts`, `lib/server/**/*.ts`, `lib/shared/**/*.ts`

### `.env.example`

Contains all 20+ environment variables with inline comments. Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:...` | PostgreSQL connection string |
| `PG_MAX_CONNECTIONS` | `10` | Connection pool size |
| `AUTH_SESSION_SECRET` | `dev-session-secret-change-me` | HMAC signing key — MUST be changed |
| `AUTH_SESSION_HOURS` | `168` | Session duration in hours |
| `AUTH_ALLOW_REGISTRATION` | `false` | Opens registration (single-user guard) |
| `LOG_LEVEL` | `info` | Logging verbosity |
| `LOG_TO_FILE` | `true` | Enable file logging |
| `STORE_TEMPLATE_URL` | big-bear-portainer URL | App store catalog source |
| `FILES_ROOT` | `/DATA` | Root directory for file manager |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | Docker socket path |
| `HOMEIO_TELEMETRY` | (unset = enabled) | Opt-out of anonymous telemetry |
| `DEMO_MODE` | (unset = false) | Enable demo/read-only mode |
| `METRICS_CACHE_TTL_MS` | `2000` | Metrics cache TTL |
| `METRICS_PUBLISH_INTERVAL_MS` | `2000` | SSE metrics push interval |
| `SSE_HEARTBEAT_MS` | `8000` | SSE keep-alive interval |

### `eslint.config.mjs`

ESLint 9 flat config. Uses `eslint-config-next` core-web-vitals + typescript. Key deviations: `no-console: off`, `@typescript-eslint/no-explicit-any: warn` (not error). `react-hooks/set-state-in-effect: off` and `react-hooks/purity: off` are disabled — these are non-standard rule names; the actual react-hooks rules are `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, so these overrides may be targeting non-existent rules.

### `next.config.mjs`

- `experimental.serverActions.bodySizeLimit: "10gb"` — very large body limit for file uploads via Server Actions
- `output: "standalone"` only when `NEXT_OUTPUT=standalone` env var is set
- `typescript.ignoreBuildErrors: true` — **critical quality issue**
- `images.unoptimized: true` — disables Next.js Image Optimization (intentional for self-hosted)
- `env.NEXT_PUBLIC_APP_VERSION` — injects version from package.json

### `docker-compose.yml`

Two services: `homeio` (the app) and `db` (PostgreSQL 16-alpine). App mounts Docker socket, a stacks named volume, and a DATA bind mount. DB has a healthcheck. App waits for DB health. Default credentials for DB are `homeio:homeio` — weak, but contained within Docker network.

### `Dockerfile`

Three-stage build (deps, builder, runner). Final image runs as non-root `homeio:1001`. Copies standalone Next.js output + compiled server + public assets + drizzle config + schema (for runtime migrations). Entrypoint runs `drizzle-kit push` before starting the server. Uses Node.js 22-alpine.

### CI/CD

No CI/CD configuration files (`.github/workflows/`, `.gitlab-ci.yml`, etc.) were found in the audited directory. The project appears to rely on manual builds and Docker Hub/GHCR image pushes outside this repository.

---

## 8. Entry Points & Data Flow

### Main Entry Points

1. **Development:** `node --import tsx server.ts` → `server.ts` (custom HTTP server)
2. **Production:** `node dist-server/server.js` → compiled `server.ts`
3. **Docker:** `docker-entrypoint.sh` runs `drizzle-kit push` then `node server.js`

### Server Startup Sequence

```
server.ts
  → next.prepare()                    — initialises Next.js app
  → ensureFilesRootDirectories()      — creates DATA/ subdirs
  → createServer()                    — raw HTTP server
  → initializeWebSocketServer(server) — attaches WS to HTTP upgrade event
  → server.listen(port)
```

### Typical HTTP Request Flow (authenticated API route)

```
Browser → HTTP → server.ts (compression middleware)
  → Next.js handle()
  → app/api/v1/apps/route.ts (GET)
    → createRequestId()
    → withServerTiming(...)
      → listInstalledApps()
        → LruCache check
        → listInstalledAppsFromDb()  — drizzle query to PostgreSQL
        → Promise.all(apps.map(inferComposePrimaryInfo))  — reads compose files
        → Promise.all(apps.map(getComposeRuntimeInfo))  — runs `docker compose ps`
      → NextResponse.json({data: apps})
```

### SSE Metrics Stream Flow

```
Browser → EventSource("/api/v1/system/stream")
  → app/api/v1/system/stream/route.ts
    → ReadableStream.start()
      → getSystemMetricsSnapshot()  — systeminformation + D-Bus helper + LruCache
      → controller.enqueue(toSseChunk("metrics.updated", snapshot))
      → setInterval(METRICS_PUBLISH_INTERVAL_MS, pushMetrics)
  ← Response(stream, {Content-Type: text/event-stream})

Client: useSystemSse hook
  → EventSource.addEventListener("metrics.updated", ...)
  → queryClient.setQueryData(queryKeys.systemMetrics, parsed)
  → All components using useSystemMetrics() re-render
```

### WebSocket Terminal Flow

```
Browser → WebSocket("/api/terminal")
  → HTTP server "upgrade" event
  → Authenticate via session cookie
  → wss.handleUpgrade() → "connection" event
    → pty.spawn("bash")
    → ws.on("message") → ptyProcess.write(data)
    → ptyProcess.onData() → ws.send(data)
  → Idle/lifetime timers enforce session limits
  → "attach" message → docker exec -it {container} bash
```

### App Install Operation Flow

```
Browser: POST /api/v1/store/apps/{appId}/install
  → startStoreOperation({appId, action: "install", ...})
    → createStoreOperation() — write to DB
    → queueMicrotask(() => executeStoreOperation())
    → return {operationId}

Browser: EventSource(/api/v1/apps/{appId}/operation/{opId}/stream)
  → subscribeToStoreOperation(operationId, callback)

Background (queueMicrotask):
  executeStoreOperation()
    → runInstallOrRedeployOperation()
      → materializeInlineStackFiles()  — write compose + env to disk
      → runComposePull()  — docker compose pull
      → runComposeUp()   — docker compose up -d
      → probeWebUi()     — HTTP health check
    → patchOperationAndEmit() at each step
      → updateStoreOperation() in DB
      → emit to SSE subscribers
    → createNotification() — write to notifications table + SSE emit
```

### Frontend/Backend Communication

- **Fetch-based:** TanStack Query hooks call REST API routes (`/api/v1/…`) via `fetch()`
- **SSE:** `EventSource` for metrics, notifications, operation progress
- **WebSocket:** Terminal only
- **Server Actions:** Used in some form submissions (registration, settings mutations)
- **No GraphQL, no tRPC**

---

## 9. Pain Points (Fresh-Eyes Perspective)

### Top 10 Things That Would Confuse a New Developer

1. **No middleware.ts for auth** — a new developer expects Next.js middleware to protect routes. Instead, auth is checked per-route individually with no centralised enforcement. It is easy to add a new API route and forget to authenticate it. The SSE streams already demonstrate this gap.

2. **Two TypeScript build configs with different semantics** — `tsconfig.json` (for Next.js, no emit) and `tsconfig.server.json` (for the custom server, CommonJS emit). A new developer editing server code may not understand why they need to run `build:server` separately or why the same code builds differently.

3. **`desktop-shell.tsx` as God Component** — at 955 lines, this file manages window state, wallpaper transitions, keyboard shortcuts, lock screen, reboot recovery, and renders all application windows. Finding where a specific feature is wired up requires reading a very large component.

4. **`compose-runner.ts` at 1450 lines** — this file does YAML manipulation, Docker CLI invocation, storage binding rewriting, volume conversion, and cleanup. There is no clear boundary between concerns, and the YAML manipulation is all done as text manipulation on lines (not using a proper YAML AST), making it brittle.

5. **Operations run in-process via `queueMicrotask`** — there is no job queue, no worker threads, no background process for app install operations. They run inside the Next.js server process. A new developer might assume there is a queue system and look for it.

6. **`@/*` path alias resolves to the repo root** — importing `@/lib/server/modules/auth/service` works from any file, including client components. The `import "server-only"` guard at the top of server files is the only protection. A client component that accidentally imports a server module will fail at runtime, not at import analysis.

7. **The dbus-helper sidecar** — it must be started separately, is in plain JavaScript, communicates over a Unix socket, and has no startup code in the main application. A developer working on network features will not find the implementation in the main codebase.

8. **`db:init` drops and recreates the migration table** — `npm run db:init` silently drops `drizzle.__drizzle_migrations` before re-running migrations. This is documented as safe because all migrations use `IF NOT EXISTS`, but it is surprising behaviour that could cause problems if a developer relies on migration history.

9. **Feature flags as a static const object** — `lib/shared/feature-flags.ts` exports `FEATURE_FLAGS = { GOOGLE_DRIVE: false }`. Adding a new feature flag requires editing this file. It is not configurable at runtime, not toggleable per-environment without code changes, and is checked with `if (FEATURE_FLAGS.GOOGLE_DRIVE)` scattered through the codebase.

10. **`next.config.mjs` with `ignoreBuildErrors: true`** — TypeScript errors silently pass through production builds. A developer who introduces a type error will see it in the editor and `npm run lint` but not in `npm run build`, which may lead to false confidence that the build succeeded cleanly.

### Top 5 Things That Would Make AI Agent Assistance Unreliable

1. **`typescript: { ignoreBuildErrors: true }`** — an AI agent generating code with type errors will see a passing build. It cannot rely on build failures to detect type-level mistakes.

2. **Text-based YAML manipulation in `compose-runner.ts`** — the file does line-by-line regex manipulation of Docker Compose YAML rather than using a proper AST. An AI agent modifying this code cannot reason about it structurally; the transformation logic is deeply intertwined with line number tracking and indentation assumptions.

3. **In-process async operations with no queue** — an AI agent writing tests for `startStoreOperation()` must understand that operations run asynchronously via `queueMicrotask` and that the test environment special-cases timing constants (`IS_TEST_ENV` with 25ms timeouts). The test isolation is fragile.

4. **No auth middleware** — an AI agent adding a new API route will not be reminded to add authentication. The pattern of calling `authenticateSession()` at the top of each handler is convention, not enforced structure.

5. **`unknown[]` types in `file-manager-derived.ts`** — the `getCurrentEntries` function accepts `unknown[]` parameters. An AI agent working on the file manager cannot statically verify that the data being passed matches the expected shape, and the transformation through `toUiFileEntry` is a hidden type assertion.

### Violations of Principle of Least Surprise

1. `npm run db:init` **destroys migration history** without a confirmation prompt or explicit `--force` flag.

2. The **terminal is a full bash shell** despite the README describing it as having a "command allowlist." The allowlist applies to a separate, simpler execution path (not the WebSocket PTY terminal).

3. **Registration is disabled by default** (`AUTH_ALLOW_REGISTRATION=false`) in `.env.example`, but the app auto-routes to `/register` on first boot if no users exist. The interplay between the env var and the first-boot detection is non-obvious.

4. The **`server-only` package** in `packages/` is a local file dependency, not the standard npm `server-only` package. It shadows the real `server-only` package. The README does not document this.

5. **`lint-staged` has a broken glob** — `"*.{js, jsx,ts,tsx}"` has a space after the comma. This means `.jsx` files may not be linted on commit, silently.

---

## 10. Recommendations Preview

- Extract a shared `parseEnvFile(filePath)` utility to eliminate the three independent env file parsers
- Split `compose-runner.ts` into separate modules: YAML manipulation, storage binding logic, Docker CLI wrapper, and status parsing
- Split `operations.ts` into separate operation handlers (install, update, uninstall, lifecycle) with a shared orchestration entry point
- Refactor `desktop-shell.tsx` by extracting window management into a `useWindowManager` hook and wallpaper logic into `useWallpaperTransition`
- Add Next.js `middleware.ts` to centrally authenticate all `/api/v1/` and page routes
- Add authentication checks to SSE endpoints (`/api/v1/system/stream`, `/api/v1/notifications/stream`)
- Fix `typescript: { ignoreBuildErrors: true }` — enable type-checking in the production build
- Move `@types/js-yaml` from `dependencies` to `devDependencies`
- Fix the broken `lint-staged` glob (`"*.{js, jsx,ts,tsx}"` → `"*.{js,jsx,ts,tsx}"`)
- Type the `getCurrentEntries` parameters as `FileListEntry[]` instead of `unknown[]`
- Add rate limiting to `/api/auth/login`
- Remove the dead branch in `resolveEnvPathFromComposePath`
- Add an OpenAPI or TypeDoc-generated API reference
- Document the dbus-helper sidecar protocol and local development setup
- Increase test coverage with unit tests for `compose-runner.ts`, `operations.ts`, and `files/service.ts` — these three files contain the most critical business logic and have the highest defect risk

---

## Absolutely Essential Files for Understanding This Codebase

The following files are the minimum set a developer or AI agent must read to understand Homeio's architecture and key design decisions:

- `server.ts` — application entry point and startup sequence
- `lib/server/env.ts` — all server environment variables and their validation
- `lib/server/db/schema.ts` — complete database schema (all 14 tables)
- `lib/shared/contracts/files.ts` — file API type contracts (representative of the contract pattern)
- `lib/shared/query-keys.ts` — complete map of all TanStack Query keys
- `modules/shell/components/desktop-shell.tsx` — the application shell and all window wiring
- `lib/server/modules/auth/service.ts` — authentication logic
- `lib/server/modules/auth/session-token.ts` — session token creation and verification
- `lib/server/modules/apps/operations.ts` — Docker app lifecycle operation machine
- `lib/server/modules/docker/compose-runner.ts` — Compose file manipulation and Docker CLI invocation
- `lib/server/modules/files/service.ts` — file system operations and path jailing
- `lib/server/modules/files/path-resolver.ts` — path resolution and jail enforcement
- `lib/server/logging/logger.ts` — structured logging pattern used throughout
- `lib/server/realtime/sse.ts` — SSE chunk formatter
- `lib/server/modules/notifications/emitter.ts` — in-memory pub/sub for notifications
- `lib/server/modules/terminal/websocket-server.ts` — terminal WebSocket and PTY implementation
- `lib/ui/surface-tokens.ts` — design system glass-morphism token strings
- `modules/files/components/manager/file-manager-state.ts` — file manager state shape
- `modules/files/components/manager/file-manager-derived.ts` — pure derivation functions
- `docker-compose.yml` — production deployment configuration
- `Dockerfile` — multi-stage build and runtime setup
- `CONTRIBUTING.md` — API conventions and module structure guide
