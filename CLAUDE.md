# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
@AGENTS.md

## Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests once (Vitest)
npm run test:watch   # Vitest in watch mode
npm run db:init      # Apply schema directly (drizzle-kit push) — use for first setup
npm run db:migrate   # Run SQL migrations (drizzle-kit migrate)
npm run db:reset     # Full database reset (destructive)
```

Run a single test file:

```bash
npx vitest run path/to/file.test.ts
```

Run tests matching a pattern:

```bash
npx vitest run --reporter=verbose -t "test name pattern"
```

## Development Setup

1. Requires Node 22.x, npm, PostgreSQL
2. `cp .env.example .env.local` — fill in required values
3. `createdb home_server`
4. `npm run db:init`
5. `npm run dev`

## Architecture

This is a **home server management dashboard** — a desktop-like UI (dock, windows, widgets, lock screen) for managing Docker-based apps on a self-hosted machine. Production runs at `localhost:12026` behind Nginx.

### Directory Layout

- `app/` — Next.js App Router. Pages: `/` (DesktopShell), `/login`, `/register`. APIs under `app/api/v1/`.
- `lib/server/modules/` — Backend business logic, one folder per domain:
  - `auth/` — sessions, password hashing, cookie management
  - `store/` — App Store: catalog fetching/caching, install/update/uninstall/redeploy operations, custom apps, update checking
  - `apps/` — installed app tracking (repository, service, stacks-repository, operations)
  - `docker/` — Docker Compose CLI wrapper (`compose-runner.ts`), compose YAML parser, container stats
  - `files/` — file manager: browsing, trash, network shares (SMB), local shares, starred paths
  - `system/` — real-time CPU/memory/disk metrics via `systeminformation`
  - `network/` — NetworkManager D-Bus integration (WiFi, Ethernet)
  - `terminal/` — shell execution backend, WebSocket session management
- `lib/server/db/` — PostgreSQL (`pg` driver). Raw SQL in `query.ts`. Drizzle ORM for schema only.
- `lib/server/env.ts` — Typed env var access. **Always use this instead of `process.env` directly.**
- `lib/server/cache/lru.ts` — LRU cache used for catalog TTL and metrics.
- `lib/server/logging/logger.ts` — Structured logging. Use `logServerAction()` and `withServerTiming()`.
- `lib/server/storage/` — Symmetric encryption utilities (used for stored credentials).
- `lib/shared/contracts/` — TypeScript types shared between client and server (apps, files, network, system, terminal, docker, weather). These are the canonical response shapes.
- `lib/shared/query-keys.ts` — TanStack Query key factory. Always use when adding new queries.
- `lib/client/` — Client-side API wrappers for calling the v1 API routes.
- `components/desktop/` — The main UI: shell, dock, app grid, app store, system widgets, terminal, file manager.
- `components/ui/` — Radix UI primitives (shadcn-style). Don't modify these.
- `hooks/` — All custom React hooks. SSE-based real-time data (`useSystemSse`), store operations (`useStoreActions`), network/apps/auth state.
- `services/dbus-helper/` — Separate Node.js process for NetworkManager D-Bus communication. Communicates over a Unix socket (`DBUS_HELPER_SOCKET_PATH`).
- `packages/` — Internal packages: `server-only` marker, `os/` (OS-specific scripts/configs).

### Key Patterns

**Repository + Service layers**: Each module has `repository.ts` (raw SQL) and `service.ts` (business logic). API route handlers call services only.

**API response shape**: All v1 routes return `{ data: T }` or `{ data: T, meta: { count: number } }`. Errors return `{ error: string }` with a 4xx/5xx status.

**Real-time**: System metrics and network events stream via SSE (`/api/v1/system/stream`, `/api/v1/network/events`). The SSE heartbeat is configurable via `SSE_HEARTBEAT_MS`.

**App Store flow**: Catalog is fetched from a remote template URL and cached (`STORE_CATALOG_TTL_MS`). Install/update/uninstall operations run `docker compose` commands inside `STORE_STACKS_ROOT`. Operation progress is tracked in the `app_operations` DB table and streamed to the frontend via SSE at `/api/v1/store/operations/{operationId}/stream`.

**Auth**: Iron-session-style signed cookies. Single-user by default (`AUTH_PRIMARY_USERNAME`). Registration can be enabled via `AUTH_ALLOW_REGISTRATION=true`. First-run detection redirects to `/register`.

**Path alias**: `@/` maps to the repo root. Use `@/lib/...`, `@/components/...`, etc.

**TypeScript**: Strict mode. `next.config.mjs` has `ignoreBuildErrors: true` for production builds, but keep TS clean in dev.

### Database Schema

Key tables in `lib/server/db/schema-definitions.ts`:

- `users` / `sessions` — auth
- `app_stacks` — installed app state: composePath, envJson (JSONB), webUiPort, status, digest fields for update detection
- `app_operations` — async operation tracking with progressPercent, currentStep, errorMessage
- `customStoreApps` — user-defined custom Docker apps (compose or docker-run converted to compose)
- `filesNetworkShares`, `filesLocalShares`, `filesTrashEntries` — file manager state

Migrations live in `./drizzle/`. Use `db:init` (push) for first-run; `db:migrate` for incremental schema changes.

### Key Environment Variables

```
DATABASE_URL            # PostgreSQL connection string
AUTH_SESSION_SECRET     # Required; min 16 chars
STORE_TEMPLATE_URL      # Remote catalog JSON URL
STORE_STACKS_ROOT       # Where compose files are written (default: /var/lib/home-server/stacks)
STORE_APP_DATA_ROOT     # App data volumes root (default: /DATA/Apps)
DOCKER_SOCKET_PATH      # Docker socket (default: /var/run/docker.sock)
DBUS_HELPER_SOCKET_PATH # DBus helper Unix socket
FILES_ROOT              # Root dir exposed by Files app (default: /DATA)
LOG_LEVEL               # debug/info/warn/error
```

### Testing

Vitest with Node environment. Tests live in `__tests__/` folders next to the files they test. Test setup in `test/setup.ts` (mocks `server-only`). Mocking: use `vi.mock()` at module level. Components are tested with `@testing-library/react` + jsdom (set via `// @vitest-environment jsdom` comment at the top of component test files).
