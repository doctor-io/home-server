# Backend Architecture (Raspberry Pi 4 optimized)

## Shape: Modular Monolith
- Runtime: Next.js Node runtime.
- Modules: `system`, `apps`, shared `db` and `cache` infrastructure.
- Realtime:
  - SSE at `/api/v1/system/stream` for one-way live metrics.
  - SSE at `/api/v1/network/events/stream` for live network state updates.

## Why this works on Pi 4
- Single deployable process reduces memory and orchestration overhead.
- Postgres handles durable state and future growth without immediate migration.
- In-memory LRU cache absorbs hot reads and smooths CPU usage.
- SSE is lightweight for dashboards and state updates.

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
- `GET /api/v1/network/events/stream` (SSE)
- `GET /api/v1/apps`
- `POST /api/v1/terminal/execute`
- `POST /api/v1/logs` (ingests client/hook logs into server log file)

## Auth Flow
- Single-user flow with bootstrap redirect:
  - If no users in DB: `/register` is the entry route.
  - If users exist: `/login` is the entry route.
- `users` and `sessions` are persisted in Postgres.
- Middleware blocks access to `/` and protected APIs unless a valid signed session cookie is present.
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
