# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Run all tests once (Vitest)
npm run test:watch   # Vitest in watch mode
npm run db:init      # Apply schema directly (drizzle-kit push)
npm run db:migrate   # Run SQL migrations (drizzle-kit migrate)
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
  - `store/` — App Store catalog (fetched from BigBearTechWorld templates), Docker Compose runner, install/uninstall/redeploy operations
  - `apps/` — installed app tracking
  - `system/` — real-time CPU/memory/disk metrics via SSE
  - `network/` — NetworkManager D-Bus integration via a separate `services/dbus-helper` process
  - `terminal/` — backend shell execution
- `lib/server/db/` — PostgreSQL (`pg` driver). No ORM; raw SQL queries.
- `lib/server/env.ts` — Typed env var access. Always use this instead of `process.env` directly.
- `lib/client/` — Client-side API wrappers for calling the v1 API routes.
- `components/desktop/` — The main UI: shell, dock, app grid, app store, system widgets, terminal, file manager.
- `components/ui/` — Radix UI primitives (shadcn-style). Don't modify these.
- `hooks/` — All custom React hooks. SSE-based real-time data (`useSystemSse`), store operations (`useStoreActions`), network/apps/auth state.
- `lib/server/db/schema-definitions.ts` — Drizzle schema definitions.

### Key Patterns

**Repository + Service layers**: Each module has `repository.ts` (raw SQL) and `service.ts` (business logic). API route handlers call services only.

**Real-time**: System metrics and network events stream via SSE (`/api/v1/system/stream`, `/api/v1/network/events`). The SSE heartbeat is configurable via `SSE_HEARTBEAT_MS`.

**App Store flow**: Catalog is fetched from a remote template URL and cached (`STORE_CATALOG_TTL_MS`). Install/update/uninstall operations run `docker compose` commands inside `STORE_STACKS_ROOT`. Operation progress is tracked in the `app_operations` DB table and polled by the frontend.

**Auth**: Iron-session-style signed cookies. Single-user by default (`AUTH_PRIMARY_USERNAME`). Registration can be enabled via `AUTH_ALLOW_REGISTRATION=true`. First-run detection redirects to `/register`.

**Path alias**: `@/` maps to the repo root. Use `@/lib/...`, `@/components/...`, etc.

**TypeScript**: Strict mode. `next.config.mjs` has `ignoreBuildErrors: true` for production builds, but keep TS clean in dev.

### Testing

Vitest with Node environment. Tests live in `__tests__/` folders next to the files they test. Test setup in `test/setup.ts`. Mocking conventions: use `vi.mock()` at the module level. Components are tested with `@testing-library/react` + jsdom (set via `// @vitest-environment jsdom` comment at the top of component test files).
