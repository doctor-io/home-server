# Backend Architecture (Raspberry Pi 4 optimized)

## Shape: Modular Monolith
- Runtime: Next.js Node runtime.
- Modules: `system`, `apps`, `files`, `network`, `notifications`, `scheduled-tasks`, shared `db` and `cache` infrastructure.
- Realtime:
  - SSE at `/api/v1/system/stream` for one-way live metrics.
  - SSE at `/api/v1/network/events/stream` for live network state updates.
  - SSE at `/api/v1/docker/stats/stream`, `/api/v1/store/operations/[operationId]/stream`, `/api/v1/notifications/stream`, and `/api/v1/files/usb/stream` for module-specific updates.

## Why this works on Pi 4
- Single deployable process reduces memory and orchestration overhead.
- Postgres handles durable state and future growth without immediate migration.
- In-memory LRU cache absorbs hot reads and smooths CPU usage.
- SSE is lightweight for dashboards and state updates.
- Large file uploads stream through the Next route and, on bare-metal installs, can be handled by the Go upload sidecar over a local Unix socket.

## API Endpoints
- `GET /api/health`
- `POST /api/auth/register` (enabled when no users exist, or when `AUTH_ALLOW_REGISTRATION=true`)
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/unlock`
- `GET /api/auth/status`
- `GET /api/v1/system/metrics`
- `GET /api/v1/system/stream` (SSE)
- `GET /api/v1/system/info`
- `GET/POST /api/v1/system/disks*`
- `GET /api/v1/network/events/stream` (SSE)
- `GET /api/v1/apps`
- `GET/POST /api/v1/files*`
- `GET/POST/PATCH/DELETE /api/v1/files/google-drive*`
- `GET/PUT/DELETE /api/v1/settings/google-oauth`
- `POST /api/v1/terminal/execute`
- `GET /api/v1/logs`

## Auth Flow
- Single-user flow with bootstrap redirect:
  - If no users in DB: `/register` is the entry route.
  - If users exist: `/login` is the entry route.
- `users` and `sessions` are persisted in Postgres.
- App routes and protected API routes call shared auth helpers such as `requireApiSession()`; there is no central middleware auth layer for all `/api/v1/**` routes.
- Lock screen uses the same authenticated session and validates password via `POST /api/auth/unlock`.

## Observability & Performance Logging
- Structured JSON logs are emitted to terminal and `LOG_FILE_PATH`.
- Every API, DB query, and realtime connection is logged with:
  - `timestamp`, `runtime`, `level`, `layer`, `action`, `status`
  - `durationMs` (where applicable), `requestId`, and `meta`
  - serialized `error` payload on failures
- Hook/client actions use the same structure and are ingested through `/api/v1/logs`.
- Useful env flags:
  - `LOG_LEVEL` and `NEXT_PUBLIC_LOG_LEVEL` for verbosity
  - `LOG_TO_FILE` to enable/disable file sink
  - `NEXT_PUBLIC_CLIENT_LOG_INGEST` to enable/disable hook log ingestion

## Client Data Strategy
- TanStack Query is configured in `AppProviders`.
- `useSystemMetrics` fetches baseline metrics.
- `useSystemSse` pushes live metric updates into query cache.
- Terminal commands are executed via the terminal API route and rendered by the desktop terminal window.

## Setup
1. Copy `.env.example` values into your runtime env.
2. Initialize DB schema:
   - run `npm run db:init`
3. Install dependencies and run:
   - `npm install`
   - `npm run dev`
