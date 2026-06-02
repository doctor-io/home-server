# v1.7 Roadmap — Stability & Pi Hardening

> **Priority:** stability only. No new features. Every step must finish, pass lint + tests, and be committed independently before the next step begins.

---

## 1. Architecture Analysis

### Runtime process map

| Process | Entry | Coupling points |
|---|---|---|
| **Main server** | `server.ts` → `dist-server/server.js` | Owns HTTP, WebSocket upgrade, compression middleware, `SIGINT`/`SIGTERM` |
| **Next.js** | Wrapped by `server.ts` via `next.getRequestHandler()` | All App Router routes run inside this process |
| **PTY / WebSocket** | `lib/server/modules/terminal/websocket-server.ts` dynamically imported | Native `@lydell/node-pty` — prebuilt binaries are arch-specific |
| **SSE streams** | `app/api/v1/{system,docker/stats,notifications,network/events,files/usb,apps/[id]/logs,store/operations/[id]}/stream/route.ts` | In-process; each stream owns a `setInterval` and an abort listener |
| **Scheduled task runner** | `instrumentation.ts` → `lib/server/modules/scheduled-tasks/runner.ts` | Started via Next.js instrumentation hook; `setInterval` is not unref'd |
| **D-Bus helper** | `services/dbus-helper/index.mjs` — separate Node.js process | Communicates over Unix socket at `DBUS_HELPER_SOCKET_PATH`; NOT started by `server.ts` |
| **Go upload sidecar** | `services/upload-server/main.go` — separate process on port 3001 | nginx routes `POST /api/v1/files/upload` directly; validates session HMAC without DB |
| **PostgreSQL** | External container or host service | Single-pool (`PG_MAX_CONNECTIONS` default 10); all domain code goes through Drizzle |

### Coupling and single points of failure

- **No timeout on `execFileAsync`** — every `docker compose pull/up/down/ps` call in `compose-runner.ts:1091` can block forever. One hung Docker daemon freezes the entire app operation queue.
- **In-process `queueMicrotask` for app operations** — there is no external job queue. A crash mid-operation leaves the DB in `running` state; `markStaleOperationsAsError` handles restart recovery, but a hung (not crashed) server does not.
- **Module-level mutable state** — `latestOperationEvent`, `operationSubscribers`, `activeOperationsByApp`, `activeDockerStatsConnections`, `storageDetailsLastKnown`, `wifiNetworksCache`, `helperStatusCache` are all process-global. None are bounded or cleaned up on SIGTERM.
- **D-Bus helper is an optional sidecar** — graceful fallback exists when the socket is absent; the main server tolerates its absence via backoff (`helperStatusUnavailableUntil`).

### ARM / Raspberry Pi sensitivities

| Area | Risk | Evidence |
|---|---|---|
| Docker image architecture | Published image is amd64-only | `.github/workflows/release.yml:154-163` — no `platforms:` key |
| `@lydell/node-pty` prebuilts | Prebuilt binary for wrong arch if image is amd64 | `Dockerfile:7` — `npm ci --ignore-scripts`; binary is downloaded at install time for the runner's arch |
| Node.js memory footprint | No heap cap; Pi 3 has 1 GB shared with OS | `docker-entrypoint.sh:7` — bare `node server.js`, no `NODE_OPTIONS` |
| `si.diskLayout()` probe | Reads `/sys` + spawns `smartctl`; slow on SD cards | `lib/server/modules/system/service.ts:267` |
| `searchFiles` recursive walk | Sequential `lstat` + directory walk blocks event loop on large NFS mounts | `lib/server/modules/files/service.ts:1361-1409` |
| PTY shell spawning | ARM Linux may lack `/usr/bin/bash`; falls through to `sh` in Docker containers but not on bare host | `websocket-server.ts:164` |
| File watchers | `startUsbPoller` uses polling (not `inotify`) — safe on ARM | `instrumentation.ts:10` |

---

## 2. Top Stability Issues — Ranked

### P0 — Must fix before any v1.7 release

---

#### P0-1 — SSE streams expose system data without authentication

**Severity:** P0  
**Files:** `app/api/v1/system/stream/route.ts:12`, `app/api/v1/docker/stats/stream/route.ts:23`, `app/api/v1/store/operations/[operationId]/stream/route.ts:45`

None of these three routes call `requireApiSession()` before constructing `ReadableStream`. The AGENTS.md hard rule ("SSE streams must authenticate before constructing ReadableStream") is violated, and the architecture boundary test (`modules/__tests__/architecture-boundaries.test.ts`) does not guard it.

**Reproduction:** `curl http://<pi-ip>:12026/api/v1/system/stream` from any LAN device — receives live CPU, memory, temperature, network, and storage metrics with no credentials.

**Pi impact:** Home servers are often on a LAN shared with family devices. Unauthenticated system metrics and Docker container stats expose server internals to any device on the network.

**Additional sub-issue in Docker stats stream** (`docker/stats/stream/route.ts:43`): `activeDockerStatsConnections++` is incremented before any auth check. An unauthenticated attacker can open 10 connections and exhaust the cap, denying service to the legitimate user.

---

#### P0-2 — `execFileAsync` has no timeout; hung Docker operations lock the queue permanently

**Severity:** P0  
**Files:** `lib/server/modules/docker/compose-runner.ts:1091`

`runComposeCommand` calls `execFileAsync("docker", args, { cwd })` with no `timeout` option. If `docker compose pull` hangs (flaky Wi-Fi mid-download, Docker daemon stuck, registry timeout), the awaited promise never resolves. Because `activeOperationsByApp.delete(params.appId)` only runs in the `finally` block of `executeStoreOperation` (`operations.ts:1205-1207`), and `executeStoreOperation` is waiting on the hung `execFileAsync`, the lock is never released. The app is stuck until server restart.

**Reproduction:** Start an app install on a Pi, pull the network cable mid-download. The install shows as "running" forever. Any subsequent install/update attempt for that app throws "already has an active operation in progress."

**Pi impact:** Pi Wi-Fi connections are fragile. This is a high-frequency failure mode.

---

#### P0-3 — `latestOperationEvent` in-memory map never pruned

**Severity:** P0  
**Files:** `lib/server/modules/apps/operations.ts:71, 391-399`

`emitEvent()` calls `latestOperationEvent.set(event.operationId, event)` on every state change. `pruneFinishedOperations()` cleans the database but has no counterpart for `latestOperationEvent`. The map grows by one entry per operation and is never cleared.

**Reproduction:** Run 500 app installs/uninstalls over several months. `latestOperationEvent` holds 500+ `StoreOperationEvent` objects in memory indefinitely.

**Pi impact:** A Pi 3 with 1 GB RAM running the server for a year will accumulate hundreds of stale entries. Small individually, but combined with other module-level caches it contributes to heap pressure.

---

### P1 — Must fix for Pi users before tagging v1.7

---

#### P1-1 — Docker CI publishes amd64-only image; ARM64/ARMv7 Pis must build from source

**Severity:** P1  
**Files:** `.github/workflows/release.yml:154-163`

The `docker/build-push-action` step specifies no `platforms:` key. `ubuntu-latest` GitHub runners are amd64; the resulting `ghcr.io/doctor-io/homeio:latest` image has no `linux/arm64` or `linux/arm/v7` manifest. Pi 4/5 (arm64) and Pi 3 (armv7) users running `docker compose up` will either get a silent emulation fallback (3-5× slower) or an explicit platform error, depending on their Docker daemon `--default-platform` setting.

**Reproduction:** `docker pull ghcr.io/doctor-io/homeio:latest` on a Pi 4 — `docker image inspect` shows `Architecture: amd64`.

**Pi impact:** This is the primary deployment path described in the README. Every Docker-based Pi install is affected.

---

#### P1-2 — Node.js process has no heap memory cap

**Severity:** P1  
**Files:** `docker-entrypoint.sh:7`, `docker-compose.yml` (no `mem_limit`)

`exec node server.js` sets no `--max-old-space-size`. V8 defaults to ~1.5 GB heap on 64-bit systems, which exceeds the total RAM of a Pi 3 (1 GB). Next.js server-side rendering, React hydration, the `systeminformation` probes, and Drizzle query objects can collectively push the heap past available RAM, triggering OOM kills with no log output.

**Reproduction:** Open the dashboard in a browser on a Pi 3, wait for several SSE stream connections to open simultaneously, navigate through file manager with a large directory. Watch `dmesg` for OOM killer events.

**Pi impact:** OOM kills without graceful shutdown leave database transactions mid-flight and Docker operations in `running` state.

---

#### P1-3 — `searchFiles` recursive walk blocks the event loop on large mounts

**Severity:** P1  
**Files:** `lib/server/modules/files/service.ts:1361-1409`

`walk()` is a sequential async recursive function: for each directory, it `await readdir`, then for each entry it `await lstat`, then `await walk(subdirectory)`. All of this runs on the same Node.js event loop tick chain without yielding. On a Pi with a 2 TB NAS share mounted at `/DATA` containing tens of thousands of files, a search query that hits a deep tree can block all other requests (including SSE heartbeats) for multiple seconds.

**Reproduction:** Mount an NFS share with 50k files, send `GET /api/v1/files/search?q=a`. Observe via `htop` that the Node.js process pegs one CPU core and other browser tabs freeze.

**Pi impact:** Pi SD card I/O is slow; sequential `lstat` calls amplify the problem.

---

#### P1-4 — `pullImagesWithProgress` `setInterval` is not unref'd

**Severity:** P1  
**Files:** `lib/server/modules/apps/operations.ts:116-127`

The progress-tick `setInterval` inside `pullImagesWithProgress` emits heartbeat progress events every 2 seconds during a `docker compose pull`. It is not `unref()`'d. If the server receives SIGTERM while a pull is in flight, the event loop stays alive waiting for the interval until the `runComposePull` promise either resolves or the process is force-killed.

**Reproduction:** Start an app install, send SIGTERM during the pull phase. The server takes up to 8 seconds (graceful shutdown timeout) to close rather than exiting cleanly.

**Pi impact:** systemd or a watchdog process waiting for clean exit may re-escalate to SIGKILL, which risks a mid-write compose file corruption.

---

### P2 — Should fix in v1.7 but not blockers

---

#### P2-1 — Architecture test does not guard SSE route authentication

**Severity:** P2  
**Files:** `modules/__tests__/architecture-boundaries.test.ts`

The existing boundary test checks module import structure (no server imports in client, no feature imports in api, etc.) but does not verify that every `app/api/v1/**` route handler calls `requireApiSession()`. P0-1 slipped through because there is no automated guard. After fixing P0-1, add a test that prevents regression.

---

#### P2-2 — Dead code in `resolveEnvPathFromComposePath`

**Severity:** P2  
**Files:** `lib/server/modules/apps/operations.ts:1007-1012`

Both branches of the `if`/`else` evaluate to the identical expression `path.join(path.dirname(composePath), ".env")`. The condition is never meaningful. Harmless but confusing during audits.

---

#### P2-3 — `lint-staged` glob has a space that prevents `.jsx` linting

**Severity:** P2  
**Files:** `package.json:33`

`"*.{js, jsx,ts,tsx}"` — the space after `js,` makes this a two-element glob `{js, jsx}` and `{ts,tsx}` in some glob libraries, causing `.jsx` files staged for commit to bypass ESLint. Low risk today (most UI code is `.tsx`) but leaves a gap.

---

#### P2-4 — `applyWebUiPortOverride` silently ignores 3-part port specs

**Severity:** P2  
**Files:** `lib/server/modules/docker/compose-runner.ts:150-167`

The regex `^(\s*-\s*["']?)(\d+)(:\d+...)$` matches only 2-part `HOST:CONTAINER` port mappings. Apps that publish ports as `0.0.0.0:8080:80` (IP:HOST:CONTAINER) or `"127.0.0.1:8080:80"` will silently have their port mapping left unchanged even when a different `webUiPort` was requested. No error is raised; the install succeeds with the wrong port.

---

#### P2-5 — Heartbeat interval on operations stream leaks on zombie connections

**Severity:** P2  
**Files:** `app/api/v1/store/operations/[operationId]/stream/route.ts:105-115`

If a client opens a stream for an already-completed operation, `send(latest)` calls `close()` synchronously, setting `closed = true`. The `heartbeat` `setInterval` is then created with a `closed` guard (`if (closed) return`), so it fires cheaply but never terminates until `request.signal` aborts. If the TCP connection is zombie (no RST, no FIN), the interval fires indefinitely. On a Pi with flaky Wi-Fi, half-open TCP connections are common.

---

## 3. v1.7 Roadmap — Sequential Steps

Steps are ordered highest-risk-first. Each step must pass `npm run lint && npm run test` before proceeding.

---

### Step 1 — Fix SSE stream authentication (P0-1)

**Title:** Require `requireApiSession()` in all three unauthenticated SSE routes

**Files to touch:**
- `app/api/v1/system/stream/route.ts`
- `app/api/v1/docker/stats/stream/route.ts`
- `app/api/v1/store/operations/[operationId]/stream/route.ts`

**What to do:**
1. Call `requireApiSession(request)` at the very top of each `GET` handler, before any `new ReadableStream`.
2. In the Docker stats stream: move `activeDockerStatsConnections++` to *after* the auth check succeeds.
3. Return `{ error: "Unauthorized", code: "unauthorized" }` with HTTP 401 if auth fails (consistent with other protected routes).
4. Add route tests in each `__tests__/route.test.ts` asserting that a request with no session cookie returns 401.

**Acceptance criteria:**
- `curl http://localhost:3000/api/v1/system/stream` with no cookie returns HTTP 401.
- Authenticated browser session still receives the SSE stream normally.
- `npm run test` passes (existing mocks in `test/setup.ts` already stub `requireApiSession` to return a valid session).

**Rollback risk:** Low — purely additive auth check. No data model changes.

**Dependencies:** None.

---

### Step 2 — Add timeout to `execFileAsync` in compose-runner (P0-2)

**Title:** Cap all Docker compose subprocess calls at a configurable timeout

**Files to touch:**
- `lib/server/modules/docker/compose-runner.ts` (function `runComposeCommand`, line 1091)
- `lib/server/env.ts` (add `DOCKER_COMPOSE_TIMEOUT_MS`)
- `.env.example`
- `lib/server/modules/docker/compose-runner.ts` tests

**What to do:**
1. Add `DOCKER_COMPOSE_TIMEOUT_MS: z.coerce.number().int().min(30_000).default(300_000)` to `envSchema` in `env.ts`. Default 5 minutes is generous for Pi + large images; minimum 30 seconds prevents accidental lock-out.
2. Pass `timeout: serverEnv.DOCKER_COMPOSE_TIMEOUT_MS` to `execFileAsync` options in `runComposeCommand`.
3. In the `.catch` handler, detect `err.killed === true` or `err.signal === 'SIGTERM'` and throw `new Error("Docker compose command timed out after ${...}s. Check Docker daemon status.")` — so the UI shows a meaningful error instead of a generic `Command failed`.
4. Document the env var in `.env.example`.

**Acceptance criteria:**
- Setting `DOCKER_COMPOSE_TIMEOUT_MS=5000` and running an install against a non-responsive registry causes the operation to fail with `"timed out"` error within ~5 seconds.
- `activeOperationsByApp` guard is released after the timeout.
- Unit test mocks `execFileAsync` to reject with a timeout error and verifies the operation transitions to `error` state.

**Rollback risk:** Low — adds a previously-absent guard; default 5 min is longer than any real operation.

**Dependencies:** Step 1 (no functional dependency, but land auth first).

---

### Step 3 — Prune `latestOperationEvent` map when operations complete (P0-3)

**Title:** Clear stale in-memory operation events on completion

**Files to touch:**
- `lib/server/modules/apps/operations.ts` (function `patchOperationAndEmit` and/or `executeStoreOperation`)

**What to do:**
1. In `executeStoreOperation`, after the final `patchOperationAndEmit` (both success and error paths, `markFinished: true`), call `latestOperationEvent.delete(operationId)`.
2. Verify that the SSE stream route at `store/operations/[operationId]/stream/route.ts` reads `latestOperationEvent` on connection — check that the delete happens *after* the final event is emitted and *after* all current subscribers have received it. The correct location is inside `executeStoreOperation`'s `finally` block, after `activeOperationsByApp.delete(params.appId)`.
3. Add a unit test: run a mock operation to completion, assert `getLatestStoreOperationEvent(operationId)` returns `null` after completion.

**Acceptance criteria:**
- After a successful install, `latestOperationEvent.size` is the same as before the install started (or 0 if it was 0).
- Long-running process that has done 100 installs shows no growth in a `process.memoryUsage().heapUsed` snapshot taken between operations.

**Rollback risk:** Low — deleting an entry from a Map; no persistence impact.

**Dependencies:** None (can be done in parallel with Step 2 but land in order for clean git history).

---

### Step 4 — Add Node.js heap cap for Pi deployments (P1-2)

**Title:** Set `NODE_OPTIONS=--max-old-space-size=512` for Pi; expose as env var

**Files to touch:**
- `docker-entrypoint.sh`
- `docker-compose.yml`
- `.env.example`

**What to do:**
1. In `docker-entrypoint.sh`, honour a `NODE_OPTIONS` env var if set, otherwise default to `--max-old-space-size=768`: `exec node ${NODE_OPTIONS:---max-old-space-size=768} server.js`.
2. In `docker-compose.yml`, add a commented-out example: `# NODE_OPTIONS: "--max-old-space-size=512"` under the Pi-friendly comment block.
3. Add `deploy.resources.limits.memory: 1g` to the `homeio` service in `docker-compose.yml` as a soft guard.

**Acceptance criteria:**
- Running `docker compose up` on a Pi and opening the dashboard does not trigger the OOM killer during normal operation.
- Setting `NODE_OPTIONS=--max-old-space-size=256` causes V8 to GC more aggressively rather than crash the process.

**Rollback risk:** Low — purely additive environment configuration.

**Dependencies:** Step 1 (deploy after auth is fixed so users update cleanly).

---

### Step 5 — Publish multi-arch Docker image (linux/amd64 + linux/arm64) (P1-1)

**Title:** Add ARM64 to the release workflow Docker build

**Files to touch:**
- `.github/workflows/release.yml`

**What to do:**
1. Add `platforms: linux/amd64,linux/arm64` to the `docker/build-push-action` step.
2. Add `uses: docker/setup-qemu-action@v3` before `setup-buildx-action` (QEMU is required for cross-compilation on the ubuntu-latest amd64 runner).
3. Verify that `@lydell/node-pty` prebuilt binaries exist for `linux-arm64` — check the package's published artifacts. If arm64 prebuilts are missing, add `RUN npm rebuild @lydell/node-pty` in the `runner` stage of `Dockerfile` with a `--platform` conditional guard.

**Acceptance criteria:**
- `docker manifest inspect ghcr.io/doctor-io/homeio:latest` shows both `linux/amd64` and `linux/arm64` manifests.
- `docker run --platform linux/arm64 ghcr.io/doctor-io/homeio:latest` starts successfully on a Pi 4 (or amd64 machine with QEMU).
- PTY terminal works on ARM64 (node-pty spawns a shell).

**Rollback risk:** Medium — CI build time increases significantly (cross-compilation). If arm64 build fails, it blocks the release. Mitigation: make arm64 a separate job that can be skipped with a commit tag if it breaks.

**Dependencies:** None. Can be done in parallel with Steps 2–4.

---

### Step 6 — Add search timeout and event-loop yield to `searchFiles` (P1-3)

**Title:** Bound `searchFiles` wall-clock time and yield between directory levels

**Files to touch:**
- `lib/server/modules/files/service.ts` (function `searchFiles`, lines 1317-1424)

**What to do:**
1. Add a `timeoutMs` parameter (default `10_000` ms for Pi; expose via `SEARCH_TIMEOUT_MS` env var).
2. Record `const deadline = Date.now() + timeoutMs` before the walk starts.
3. At the top of `walk()`, add `if (Date.now() > deadline) return;` to stop traversal when time expires.
4. After each `await walk(subdirectory, ...)` call, add `await setImmediate()` (i.e., `await new Promise(r => setImmediate(r))`) to yield the event loop between subdirectory traversals.
5. If the deadline is hit, set a flag and include `{ truncated: true }` in the response payload so the client can show "results may be incomplete."

**Acceptance criteria:**
- A search against a directory tree with 100k files returns within 11 seconds (deadline + overhead) rather than blocking indefinitely.
- While a search is running, the system SSE stream heartbeat is not delayed by more than 200 ms.
- Existing `searchFiles` tests still pass.

**Rollback risk:** Low — adds a deadline guard; behaviour only changes when search would previously have taken longer than `timeoutMs`.

**Dependencies:** None.

---

### Step 7 — Unref progress setInterval in `pullImagesWithProgress` (P1-4)

**Title:** Allow graceful shutdown during active image pull

**Files to touch:**
- `lib/server/modules/apps/operations.ts` (function `pullImagesWithProgress`, lines 116-128)

**What to do:**
1. Call `interval.unref()` immediately after `setInterval(...)` at line 116.
2. Verify that `clearInterval(interval)` still runs in the `finally` block (it does at line 126).

**Acceptance criteria:**
- Sending SIGTERM to the process during a `docker compose pull` results in the server exiting within the 8-second graceful shutdown timeout, not hanging indefinitely.
- The pull operation itself continues in the child process (Docker daemon is not killed); only the Node.js progress tracking interval is un-blocked.

**Rollback risk:** Very low — single one-line change.

**Dependencies:** Step 2 (do after exec timeout is in place so the pull itself is bounded too).

---

### Step 8 — Add architecture test to guard SSE route auth (P2-1)

**Title:** Automated guard: all `/api/v1/**` routes must call `requireApiSession`

**Files to touch:**
- `modules/__tests__/architecture-boundaries.test.ts`

**What to do:**
1. Add a new `it` block that scans every `.ts` file under `app/api/v1/` for exported `GET`/`POST`/`PUT`/`PATCH`/`DELETE` handlers.
2. For each such file, assert that the file source contains `requireApiSession` OR is on an explicit allowlist (e.g., `app/api/health/route.ts`, `app/api/auth/login/route.ts`).
3. Initially allowlist the files fixed in Step 1 to ensure the test passes immediately, then the allowlist shrinks as you audit other routes.

**Acceptance criteria:**
- `npm run test` fails if a new `route.ts` under `app/api/v1/` exports an HTTP handler without `requireApiSession` and is not explicitly allowed.
- The test passes after Step 1 is applied.

**Rollback risk:** Very low — test only; no production code change.

**Dependencies:** Step 1 must land first.

---

### Step 9 — Fix dead code and lint-staged glob (P2-2, P2-3)

**Title:** Two-line correctness fixes

**Files to touch:**
- `lib/server/modules/apps/operations.ts:1007-1012`
- `package.json:33`

**What to do:**
1. In `resolveEnvPathFromComposePath`: remove the `if`/`else` branches; keep only the single `return path.join(path.dirname(composePath), ".env")` expression.
2. In `package.json` `lint-staged`: fix `"*.{js, jsx,ts,tsx}"` → `"*.{js,jsx,ts,tsx}"` (remove the space).

**Acceptance criteria:**
- `npm run lint` passes.
- `npm run test` passes.
- Staging a `.jsx` file and running `git commit` triggers ESLint on that file.

**Rollback risk:** Very low.

**Dependencies:** None.

---

### Step 10 — Pi validation milestone

**Title:** End-to-end smoke test on real ARM64 hardware (or QEMU)

**Files to touch:** None (validation only — creates a checklist issue in GitHub).

**Test matrix:**

| Scenario | Expected | Pass criteria |
|---|---|---|
| Pull the new `linux/arm64` Docker image on a Pi 4 | Image downloads, container starts | `docker ps` shows `Up` status; `/api/health` returns 200 |
| Open dashboard, let system SSE stream for 5 min | No OOM kill | `dmesg` clean; heap stays under 512 MB (`NODE_OPTIONS` set) |
| Install one app from the store over Wi-Fi | Completes in < 5 min | App shows as installed; `latestOperationEvent` size unchanged afterward |
| Kill Wi-Fi during a second app install | Install fails with timeout message | Fails within `DOCKER_COMPOSE_TIMEOUT_MS`; app unlocked afterward |
| Search for a file in a 10k-file directory | Results return | Within 11 seconds; no SSE heartbeat gap > 200 ms |
| Connect to terminal (PTY) | Shell prompt appears | `node-pty` arm64 prebuilt loads; `bash` spawns |
| SIGTERM the container | Clean exit | Exits within 8 seconds; no OOM kill; `docker logs` shows shutdown message |
| Open system metrics stream without a session cookie | 401 response | `curl` gets `{"error":"Unauthorized"}` |

**Acceptance criteria:** All 8 rows pass on at least one physical Pi 4 (arm64) or a QEMU `linux/arm64` container.

**Rollback risk:** N/A — no code change.

**Dependencies:** Steps 1–9 must all be merged.

---

## 4. Out of Scope for v1.7

The following are deferred to v1.8+ to prevent scope creep. Do not begin these until v1.7 is tagged.

- **WebSocket / SSE multiplexing:** Consolidating multiple SSE streams into a single connection to reduce Pi connection overhead.
- **Dependency upgrades:** No `next`, `drizzle-orm`, `@tanstack/react-query`, or `systeminformation` version bumps unless a specific CVE is identified.
- **App store catalog improvements:** New templates, categories, or YAML schema changes.
- **Terminal emulator features:** xterm.js options, clipboard integration, multi-pane support.
- **File manager features:** Zip/unzip, bulk rename, batch delete.
- **Network manager UI:** D-Bus wifi connect/disconnect UI improvements.
- **Scheduled tasks UI:** New task types, cron expression builder.
- **Database schema migrations:** No new tables or columns unless required for a P0/P1 fix.
- **ARMv7 (32-bit Pi 2/3) support:** node-pty prebuilts for `linux-arm` may not exist; investigating this is v1.8 work.
- **HTTPS / TLS termination:** nginx or Caddy integration for self-signed certs.
- **Multi-user support:** Auth is currently single-primary-user + optional registration; expanding this is a feature, not a fix.
- **External secret management:** Vault, Docker secrets, or env file encryption.
- **Observability stack:** Prometheus metrics endpoint, Grafana dashboards.
- **`applyWebUiPortOverride` 3-part port spec fix (P2-4):** Requires careful YAML rewrite; defer to v1.8 with a proper test suite expansion for `compose-runner`.

---

## Feature Scope (added 2026-05-16)

> **Status update:** Steps 1–9 above are committed (`fc0ab78` through `e8412cd`, versions 1.5.33 → 1.7.3). Step 10 (Pi validation matrix) becomes a release-gate that runs after the feature work below also lands. v1.7 is no longer a pure stability release — it grows to include four headline features. To avoid scope sprawl, this section breaks each feature into the smallest sequential steps we can ship and test independently.

### Feature scope (verbatim from the user)

1. **Reverse Proxy & SSL Certificate Management** — proxy rules database, "Expose" button on app cards, ACME (Let's Encrypt) / self-signed certs, HTTP→HTTPS redirect, DDNS providers (Cloudflare, DuckDNS, No-IP).
2. **SMART Disk Health Monitoring** — per-drive SMART attributes via `smartctl`, health classification (Pass/Warning/Failed), drive temperature in live metrics, threshold notifications, scheduled short/long self-tests.
3. **Hardware Sensor Monitoring** — CPU die + per-core temps, NVMe/SSD temps (shares the SMART pipeline), fan RPM where available.
4. **Two-Factor Authentication (TOTP)** — single-user TOTP enrolment via QR, 10 one-time backup codes, mandatory at login when enabled, disable via current TOTP or backup code.

### Cross-feature decisions (locked)

- **Reverse proxy uses Caddy, not nginx.** Caddy bundles ACME natively, has a JSON Admin API, and ships a single static binary for both `linux/amd64` and `linux/arm64`. Caddy runs as a child process inside the Homeio container and is managed via its Admin API at `localhost:2019`. The previous "out-of-scope" line about nginx/Caddy is now obsolete.
- **All new tables are additive.** No destructive migrations. The drizzle migration journal stays append-only.
- **Pi compatibility is non-negotiable.** Every step below must work on `linux/arm64`. If a dependency (smartctl, sensors) isn't installable on Pi, the feature degrades gracefully with a clear UI state.
- **Auth changes ship behind the existing single-user model.** Multi-user 2FA enforcement is explicitly v2.0.
- **One feature at a time, in this order:** 2FA → Sensors → SMART → Reverse Proxy + DDNS. Each feature must finish (all steps green, tests passing) before the next feature opens its first commit. No parallel branches.

### Ground rules for execution

1. Each numbered step below is a single commit. Don't bundle steps. Don't skip ahead.
2. Every step lists: files to touch, acceptance criteria, rollback risk, dependencies. If a step needs more clarification mid-execution, **stop and ask**.
3. Tests beside the code. New service code gets a `__tests__/<name>.test.ts`. New routes get a `__tests__/route.test.ts` with at minimum a 401 case and a success case.
4. Contracts before routes. Every new feature starts with `lib/shared/contracts/<feature>.ts`.
5. Migrations via `npm run db:generate` — never hand-edit drizzle journal files.
6. After each step: `npm run lint && npm run test`. Husky's pre-commit (`npm run build`) is the second gate.
7. The architecture test added in Step 8 means: every new `app/api/v1/**` route ships with `authenticateSession()` on day one. No new entries are added to `V1_AUTH_ALLOWLIST`.

---

## Feature A — Two-Factor Authentication (TOTP)

**Why first:** smallest blast radius, isolated to the auth module, hardens login surface before the reverse proxy exposes new attack surface. ~9 steps.

### A1. Schema: add TOTP columns to `users`

- **Files:** `lib/server/db/schema.ts`, generated migration under `drizzle/`.
- **Add:** `totpSecret: text("totp_secret")` (nullable, encrypted at rest — see A2), `totpEnabled: boolean("totp_enabled").notNull().default(false)`, `totpBackupCodes: text("totp_backup_codes")` (nullable, encrypted JSON array of hashed codes), `totpEnrolledAt: timestamp("totp_enrolled_at")` (nullable).
- **Acceptance:** `npm run db:generate` produces an additive migration; `npm run db:migrate` against a clean DB succeeds; an existing seed row with `totpEnabled = false` works unchanged.
- **Rollback risk:** Low — purely additive, no data backfill required.
- **Deps:** None.

### A2. Encryption helper for TOTP secrets and backup codes

- **Files:** `lib/server/modules/auth/totp-crypto.ts` (new), `lib/server/env.ts` (add `AUTH_TOTP_ENCRYPTION_KEY` — defaults to a key derived from `AUTH_SESSION_SECRET` via HKDF so existing deployments don't break).
- **API:** `encryptSecret(plaintext): string`, `decryptSecret(ciphertext): string`. Use Node's `crypto.createCipheriv` with AES-256-GCM; store as `iv.cipher.tag` base64 strings.
- **Acceptance:** Unit tests covering round-trip, tampered ciphertext throws, and key rotation produces a different ciphertext for the same input.
- **Rollback risk:** Low — only invoked by code added in later steps.
- **Deps:** None.

### A3. TOTP service (secret generation, code validation, backup codes)

- **Files:** `lib/server/modules/auth/totp.ts` (new). Use Node's built-in `crypto` (HMAC-SHA1, RFC 6238) — no new dependency.
- **API:** `generateTotpSecret(): { secret: string, otpAuthUrl: string }`, `verifyTotp(secret, code, window = 1): boolean`, `generateBackupCodes(count = 10): { plaintext: string[], hashes: string[] }`, `verifyBackupCode(hashes, code): { matchedHash: string | null }`. otpauth URL embeds `issuer=Homeio` and `account=<username>`.
- **Acceptance:** Unit tests with RFC 6238 reference vectors. Backup codes are 10 chars, alphanumeric, hashed with scrypt or sha256 before storage.
- **Rollback risk:** Low — pure functions, no DB or HTTP.
- **Deps:** A2 (uses encryption helper for downstream consumers).

### A4. API: `/api/v1/auth/2fa/setup` (POST)

- **Files:** `app/api/v1/auth/2fa/setup/route.ts` (new), `lib/shared/contracts/auth.ts` (extend with TOTP types), `__tests__/route.test.ts`.
- **Behaviour:** Requires authenticated session. Returns `{ secret, otpAuthUrl, qrCodeSvg }`. Generates and stores an *unconfirmed* secret on the user row (write `totpSecret` but leave `totpEnabled = false`). QR is rendered server-side as inline SVG using a small QR library (`qrcode` npm package, ~30 KB) — or implement a minimal QR encoder if we want zero new deps. Decision in PR.
- **Acceptance:** Unauthenticated → 401. Authenticated, never enrolled → 200 with QR. Authenticated, already enrolled → 409 "already enabled, disable first".
- **Rollback risk:** Low. Writing the unconfirmed secret is reversible by setting it to NULL.
- **Deps:** A1, A2, A3.

### A5. API: `/api/v1/auth/2fa/verify` (POST)

- **Files:** `app/api/v1/auth/2fa/verify/route.ts` (new), `__tests__/route.test.ts`.
- **Behaviour:** Body `{ code: string }`. Reads `totpSecret`, validates code, on success sets `totpEnabled = true`, generates and stores 10 backup-code hashes (returns plaintext **once only** in the response), sets `totpEnrolledAt = now()`.
- **Acceptance:** Unauthenticated → 401. Wrong code → 400 `{ code: "invalid_totp" }`. Right code, fresh enrolment → 200 with `{ backupCodes: string[] }`. Replaying the same code within the window → 400 (anti-replay: track last-used code in memory or DB column).
- **Rollback risk:** Low.
- **Deps:** A4.

### A6. API: `/api/v1/auth/2fa/disable` (POST)

- **Files:** `app/api/v1/auth/2fa/disable/route.ts` (new), `__tests__/route.test.ts`.
- **Behaviour:** Body `{ code: string }` (TOTP or backup). Requires authenticated session AND a valid TOTP/backup code. On success clears `totpSecret`, `totpEnabled = false`, `totpBackupCodes = null`, `totpEnrolledAt = null`. If the user provided a backup code, consume it (remove from stored hashes) before clearing — but since we're disabling, just clearing all is fine.
- **Acceptance:** Wrong code → 400. Right code → 200 `{ enabled: false }`. Calling when `totpEnabled = false` → 409.
- **Rollback risk:** Low.
- **Deps:** A3, A5.

### A7. Login flow: handle TOTP-required users

- **Files:** `lib/server/modules/auth/service.ts` (extend `loginUser`), `app/api/v1/auth/login/route.ts` (if it exists; else trace the actual login route), shared contract for login response.
- **Behaviour:** After password verification, if `totpEnabled = true`, **do not issue a session yet.** Return `{ requiresTotp: true, partialAuthToken: string }` where `partialAuthToken` is a short-lived (5 min) signed token containing the user ID and `partialAuth: true` flag (HMAC with `AUTH_SESSION_SECRET`, distinct from session tokens). Only the partial token can call A8.
- **Acceptance:** User without TOTP → existing happy path (session cookie issued). User with TOTP → 200 `{ requiresTotp: true, partialAuthToken }` and no session cookie. Wrong password → existing 401.
- **Rollback risk:** Medium — touches the most-used auth route. Must keep the existing happy path bit-for-bit identical for non-TOTP users.
- **Deps:** A1, A6.

### A8. API: `/api/v1/auth/login/totp` (POST)

- **Files:** `app/api/v1/auth/login/totp/route.ts` (new), `__tests__/route.test.ts`.
- **Behaviour:** Body `{ partialAuthToken, code }`. Validates token signature + expiry. Looks up user, validates TOTP or backup code. On success issues the full session cookie (same path as the existing login route does) and consumes the backup code if used. Failure → 401.
- **Acceptance:** Valid token + valid code → 200 with session cookie. Valid token + wrong code → 401 (do not invalidate token — allow retry until token expires). Expired token → 401 `{ code: "partial_auth_expired" }`.
- **Rollback risk:** Low — new endpoint.
- **Deps:** A7.

### A9. UI: Settings → Security 2FA card + login TOTP step

- **Files:** New section under `modules/settings/components/panel/sections/security-section.tsx` (or add to existing if present), new client hooks in `modules/settings/hooks/`, login UI change in the auth flow component, new components for QR display + backup-code download.
- **Behaviour:**
  - Settings card: status badge ("2FA disabled" or "2FA enabled since DATE"), Enable button → wizard (show QR + manual key → input field for first code → on success show backup codes with copy/download buttons → require confirmation that user saved them before closing).
  - Login screen: when API responds with `requiresTotp`, swap form to TOTP input with "Use backup code instead" toggle.
- **Acceptance:** Manual E2E: enable 2FA, log out, log back in via TOTP, log out, log back in via backup code, disable 2FA, log back in without TOTP. All paths render correct UI states.
- **Rollback risk:** Medium — login UI change visible to every user. Feature-flag behind A1's `totpEnabled` column so non-enrolled users see zero UI difference.
- **Deps:** A4 through A8.

**Feature A acceptance:** All A1–A9 committed; `npm run test` green; manual E2E walks the full enrol → login → recover → disable path on a real dev instance.

---

## Feature B — Hardware Sensor Monitoring

**Why second:** read-only, no new write surfaces, leans on the existing `systeminformation` package + `/sys/class` parsing. Lowest risk of the four. ~6 steps.

### B1. Extend `lib/shared/contracts/system.ts` with sensor fields

- **Add:** `sensors?: { cpu: { mainCelsius, coresCelsius[], maxCelsius }, drives: { device, label, celsius }[], fans: { label, rpm }[] }`. All fields nullable so missing hardware degrades gracefully.
- **Acceptance:** Type-check passes; existing `SystemMetricsSnapshot` consumers don't break.
- **Rollback risk:** Low — additive contract.
- **Deps:** None.

### B2. CPU temp from `/sys/class/thermal`

- **Files:** `lib/server/modules/system/sensors-service.ts` (new), unit tests with fixture files.
- **Behaviour:** Parse every `/sys/class/thermal/thermal_zone*/temp` (millicelsius) + matching `type` file. Map zone types to friendly labels (`x86_pkg_temp` → "CPU package", `cpu-thermal` → "CPU"). Return null if no zones found.
- **Acceptance:** Unit test with mocked `fs` reads asserting parser outputs. Pi-style `thermal_zone0` with type `cpu-thermal` returns the right shape.
- **Rollback risk:** Low — read-only.
- **Deps:** B1.

### B3. Fan RPM from `/sys/class/hwmon`

- **Files:** Extend `sensors-service.ts`, more fixture tests.
- **Behaviour:** Walk `/sys/class/hwmon/hwmon*/fan*_input` files. Each entry is RPM. Use the sibling `*_label` if present, else `hwmon{X}-fan{N}`. Skip entries reporting 0 RPM (likely disabled).
- **Acceptance:** Unit test with mocked fs. On a Pi with no fan sensors, returns `[]` cleanly.
- **Rollback risk:** Low.
- **Deps:** B2.

### B4. Drive temperature (forward-reference SMART)

- **Files:** Add a placeholder `getDriveTemperatures(): Promise<DriveTemp[]>` that returns `[]`. The SMART feature (C2) will fill it. This keeps the sensor contract complete and avoids backtracking later.
- **Acceptance:** Returns `[]`. Type-check passes.
- **Rollback risk:** Trivial.
- **Deps:** B1.

### B5. Wire sensors into `getSystemMetricsSnapshot`

- **Files:** `lib/server/modules/system/service.ts` — call the new sensor service inside `collectSnapshot()` using the existing `withFallback` wrapper so failures don't break the metrics stream.
- **Acceptance:** Hitting `/api/v1/system/stream` returns frames containing the new `sensors` field. Existing fields unchanged.
- **Rollback risk:** Low (failures fall back via `withFallback`).
- **Deps:** B2, B3, B4.

### B6. UI: sensor panel in System module

- **Files:** New component under `modules/system/components/sensors-panel.tsx`, wire into the existing System module page.
- **Behaviour:** Group: CPU temps (main + cores), Drive temps, Fan RPMs. Each value shown with a unit. Empty groups hidden (so Pi users see only CPU).
- **Acceptance:** Render with mock metrics; verify hidden state for empty groups.
- **Rollback risk:** Low (UI-only).
- **Deps:** B5.

**Feature B acceptance:** Full SSE round-trip on a Pi shows real CPU thermal data; SMART placeholder waits for Feature C.

---

## Feature C — SMART Disk Health Monitoring

**Why third:** depends on shelling out to `smartctl`. Notifies via the existing pipeline added incrementally. ~9 steps.

### C1. Detect `smartctl` and probe drives

- **Files:** `lib/server/modules/system/smart-service.ts` (new), unit tests.
- **Behaviour:** `isSmartctlAvailable(): Promise<boolean>` (shell `which smartctl` or run `smartctl --version`). `listDrives(): Promise<{ device: string, model: string }[]>` (run `smartctl --scan` and parse output). Caches availability for the process lifetime.
- **Acceptance:** Unit test mocks `child_process.execFile`. When smartctl is absent, returns `false` / `[]`, no crash.
- **Rollback risk:** Low — read-only subprocess call.
- **Deps:** None.

### C2. SMART data collection (per drive)

- **Files:** Extend `smart-service.ts`.
- **Behaviour:** `getSmartData(device): Promise<SmartAttributes>` runs `smartctl -a -j <device>` (JSON output), parses key attributes: `reallocated_sector_ct`, `current_pending_sector`, `offline_uncorrectable`, `power_on_hours`, `temperature.current`, overall `smart_status.passed`. Returns a typed object.
- **Acceptance:** Unit tests with sample JSON fixtures from real Pi SSD + typical HDD outputs.
- **Rollback risk:** Low.
- **Deps:** C1.

### C3. Schema: `smart_snapshots` table

- **Files:** `lib/server/db/schema.ts`, generated migration.
- **Columns:** `id`, `device`, `model`, `serial`, `overallStatus` enum (`passed`/`warning`/`failed`/`unknown`), `temperatureCelsius` nullable, `powerOnHours` nullable, `attributesJson` text (full parsed JSON), `lastCheckedAt` timestamp, `lastTestRunAt` nullable.
- **Acceptance:** Migration applies cleanly. Repository functions `upsertSnapshot`, `getLatestSnapshots()`, `getSnapshotByDevice(device)`.
- **Rollback risk:** Low — additive table.
- **Deps:** None.

### C4. Classification rules

- **Files:** `smart-service.ts` — function `classifyHealth(attrs): "passed" | "warning" | "failed"`.
- **Rules:** Failed if `smart_status.passed === false` OR `reallocated_sector_ct > 0` OR `offline_uncorrectable > 0`. Warning if `current_pending_sector > 0` OR temperature > 60 °C. Otherwise passed.
- **Acceptance:** Unit tests for each rule branch.
- **Rollback risk:** Low.
- **Deps:** C2.

### C5. Background SMART poller

- **Files:** `lib/server/modules/system/smart-runner.ts` (new), wired in `instrumentation.ts`.
- **Behaviour:** Poll every `SMART_POLL_INTERVAL_MS` (default 6h, min 1h, env-configurable). For each detected drive, fetch attributes, classify, upsert snapshot. Interval is unref'd (graceful shutdown). Skips entirely if smartctl unavailable.
- **Acceptance:** Unit test starts the runner, mocks the service, verifies repository calls. Runner doesn't crash when smartctl is absent.
- **Rollback risk:** Low.
- **Deps:** C1–C4.

### C6. Notifications on state changes

- **Files:** Extend the SMART runner; integrate with `lib/server/modules/notifications/service.ts`.
- **Behaviour:** Compare new snapshot to prior snapshot for the same device. Notify on state transitions `passed → warning`, `passed → failed`, `warning → failed`. Don't notify on every poll — only on changes.
- **Acceptance:** Unit test verifies notification is created exactly once on transition and never on stable status.
- **Rollback risk:** Low.
- **Deps:** C5.

### C7. API: `/api/v1/system/smart` (GET)

- **Files:** `app/api/v1/system/smart/route.ts`, `__tests__/route.test.ts`.
- **Behaviour:** Auth required. Returns array of `{ device, model, status, temperatureCelsius, powerOnHours, lastCheckedAt }`.
- **Acceptance:** 401 unauthenticated; 200 with array authenticated.
- **Rollback risk:** Low.
- **Deps:** C3.

### C8. Wire drive temps into Feature B's `getDriveTemperatures()`

- **Files:** Replace the B4 placeholder with a real implementation that reads from `smart_snapshots`.
- **Acceptance:** `/api/v1/system/stream` frames include drive temps when SMART data exists.
- **Rollback risk:** Low.
- **Deps:** B4, C7.

### C9. UI + scheduled self-test trigger

- **Files:** Extend `modules/system/components/sensors-panel.tsx` (or a new `smart-panel.tsx`), add a "Run short test" button that POSTs to `/api/v1/system/smart/tests` (new route — runs `smartctl -t short`). Persist next-test-due date in the snapshots table.
- **Acceptance:** Manual: clicking the button kicks off a short test; the runner picks up the result on its next poll.
- **Rollback risk:** Low — test runs in the background, no destructive operation.
- **Deps:** C5, C7.

**Feature C acceptance:** SMART panel on a Pi with an SSD shows real attributes; pulling the drive (or simulating with a fake failed status) triggers a notification.

---

## Feature D — Reverse Proxy + SSL + DDNS (Caddy)

**Why last:** largest blast radius. Affects networking, container privileges, and is the only feature that introduces a co-resident process. ~27 steps. Ships as several sub-PRs.

### Sub-D1 — Caddy integration (foundation)

#### D1. Bundle Caddy in the Docker image

- **Files:** `Dockerfile` — add a builder stage that downloads `caddy_<ver>_linux_<arch>.tar.gz` from the official releases for both amd64 and arm64; copy `caddy` binary into the runner stage; add `setcap 'cap_net_bind_service=+ep' /usr/local/bin/caddy` so non-root can bind to 80/443.
- **Acceptance:** `docker build` succeeds on both arches; `docker run ghcr.io/doctor-io/homeio caddy version` prints the version.
- **Rollback risk:** Medium — image grows ~30 MB; layer caching changes. Revert by removing the COPY lines.
- **Deps:** None (independent of Feature A/B/C).

#### D2. Caddy lifecycle wrapper

- **Files:** `lib/server/modules/proxy/caddy-runtime.ts` (new), wired in `server.ts`'s shutdownHooks.
- **Behaviour:** `startCaddy()` spawns `caddy run --resume --config /dev/stdin` with an empty admin-only config (`{ "admin": { "listen": "localhost:2019" } }`). Captures stdout/stderr to the server log. `stopCaddy()` sends SIGTERM, awaits exit with timeout (5s) then SIGKILL.
- **Acceptance:** Server start → Caddy alive on localhost:2019 (`GET /config/`). SIGTERM to homeio shuts both down cleanly.
- **Rollback risk:** Medium — adds a child process to manage.
- **Deps:** D1.

#### D3. Caddy Admin API client

- **Files:** `lib/server/modules/proxy/caddy-client.ts` (new), unit tests with mocked fetch.
- **Behaviour:** `loadConfig(json): Promise<void>` POSTs to `localhost:2019/load`. `getCerts(): Promise<CertInfo[]>` reads from the admin API. Handles connection retries with backoff for the first 5 seconds after startup.
- **Acceptance:** Unit tests with `vi.fn` over `fetch`.
- **Rollback risk:** Low.
- **Deps:** D2.

### Sub-D2 — Proxy data model

#### D4. Schema: `proxy_rules`

- **Files:** `lib/server/db/schema.ts`, migration.
- **Columns:** `id`, `appId` nullable FK, `domain` (unique), `targetHost` (default `127.0.0.1`), `targetPort` int, `protocol` enum `http`/`https`/`auto`, `tlsMode` enum `acme`/`internal`/`none`, `redirectHttpToHttps` bool, `createdAt`, `updatedAt`.
- **Acceptance:** Migration applies; repository functions `createRule`, `listRules`, `findByDomain`, `findByAppId`, `updateRule`, `deleteRule` with tests.
- **Rollback risk:** Low.
- **Deps:** None.

#### D5. Contracts

- **Files:** `lib/shared/contracts/proxy.ts` (new) + query keys.
- **Acceptance:** Type-only PR, no runtime.
- **Rollback risk:** None.
- **Deps:** D4.

### Sub-D3 — Caddy config renderer

#### D6. Config renderer

- **Files:** `lib/server/modules/proxy/caddy-config.ts` (new), unit tests.
- **Behaviour:** `renderCaddyConfig(rules: ProxyRule[]): CaddyConfig` builds JSON apps `http` config: one `server` listening on `:80` and `:443`, one route per rule with a `host` matcher, `reverse_proxy` to `targetHost:targetPort`, `tls` block per `tlsMode`. ACME uses Caddy's default issuer; `internal` uses Caddy's internal CA; `none` disables TLS.
- **Acceptance:** Snapshot tests for representative rule sets (single rule, multi-rule, wildcard, internal CA, no TLS).
- **Rollback risk:** Low — pure function.
- **Deps:** D3, D5.

#### D7. Sync DB → Caddy on startup and on every mutation

- **Files:** `lib/server/modules/proxy/proxy-service.ts` (new). Called from `server.ts` after Caddy starts (initial sync) and from every CRUD route handler.
- **Behaviour:** Read all `proxy_rules`, render config, POST to Caddy. On Caddy reload failure: log error + return 502 to the API caller (but the DB write already succeeded — UI should refresh and show a "Caddy reload failed" banner).
- **Acceptance:** Integration test: create a rule via service, mock Caddy client, verify the right payload is POSTed.
- **Rollback risk:** Medium.
- **Deps:** D6.

### Sub-D4 — API + UI for proxy rules

#### D8. API: `/api/v1/proxy/rules` (GET, POST)

- **Files:** `app/api/v1/proxy/rules/route.ts`, `__tests__/route.test.ts`.
- **Acceptance:** Auth required. POST validates domain (RFC-1035 + length), prevents duplicate domains, calls D7. GET lists rules with their cert status from Caddy.
- **Rollback risk:** Low.
- **Deps:** D7.

#### D9. API: `/api/v1/proxy/rules/[ruleId]` (GET, PATCH, DELETE)

- **Files:** Route + tests.
- **Acceptance:** PATCH allows changing `domain`, `targetPort`, `tlsMode`, `redirectHttpToHttps`. DELETE removes the rule and re-syncs Caddy.
- **Rollback risk:** Low.
- **Deps:** D8.

#### D10. API: `/api/v1/proxy/certificates` (GET)

- **Files:** Route + tests.
- **Acceptance:** Reads cert info via D3's `getCerts()`. Returns issuer, expiry, status per domain.
- **Rollback risk:** Low.
- **Deps:** D3.

#### D11. UI: proxy module list view

- **Files:** `modules/proxy/components/proxy-rules-list.tsx` (new), hooks under `modules/proxy/hooks/`, register in desktop shell.
- **Acceptance:** Renders existing rules with badges for cert status. Shows "Caddy not reachable" banner if D7's last sync failed.
- **Rollback risk:** Low — UI only.
- **Deps:** D8, D10.

#### D12. UI: "Expose" button on app cards

- **Files:** Modify `modules/apps/components/app-card.tsx` (or equivalent). Read installed app's `webUiPort`, pre-fill the rule wizard.
- **Acceptance:** Clicking "Expose" opens a dialog with port pre-filled; submitting creates a rule via D8.
- **Rollback risk:** Low.
- **Deps:** D11.

#### D13. UI: create-rule wizard (full)

- **Files:** `modules/proxy/components/create-rule-wizard.tsx`.
- **Acceptance:** Three steps: pick app (or "Custom target"), enter domain, choose TLS mode. Wizard validates inputs and surfaces D8 errors inline.
- **Rollback risk:** Low.
- **Deps:** D12.

#### D14. UI: certificate panel

- **Files:** `modules/proxy/components/certificates-panel.tsx`.
- **Acceptance:** Lists certs with issuer, expiry, renewal status. "Renew now" button POSTs to a new endpoint that triggers Caddy to re-issue (Caddy will pick up automatically; the endpoint just forces a config reload).
- **Rollback risk:** Low.
- **Deps:** D10.

### Sub-D5 — App lifecycle integration

#### D15. Auto-update rule on app port change / uninstall

- **Files:** Hook into `lib/server/modules/apps/operations.ts` — after an install/redeploy/uninstall completes, look up matching `proxy_rules.appId`, update `targetPort` or delete the rule.
- **Acceptance:** Integration test: install app → expose → change port → rule's targetPort updates → uninstall → rule deleted.
- **Rollback risk:** Medium — touches the most-used path in the app operations queue. Gate behind a feature flag (`FEATURE_PROXY_AUTO_SYNC = true` default).
- **Deps:** D8, D11.

### Sub-D6 — DDNS

#### D16. DDNS provider abstraction

- **Files:** `lib/server/modules/ddns/provider.ts` (new) — interface `{ name, updateRecord({ ip, hostname, credentials }): Promise<UpdateResult> }`.
- **Acceptance:** Interface only; no implementations yet.
- **Rollback risk:** None.
- **Deps:** None.

#### D17. Cloudflare provider

- **Files:** `lib/server/modules/ddns/providers/cloudflare.ts` + tests.
- **Behaviour:** Uses Cloudflare API token to update a DNS A record. Looks up zone and record IDs lazily, caches them.
- **Acceptance:** Unit test with mocked fetch.
- **Rollback risk:** Low.
- **Deps:** D16.

#### D18. DuckDNS provider

- **Files:** `lib/server/modules/ddns/providers/duckdns.ts` + tests.
- **Behaviour:** Simple HTTPS GET to `www.duckdns.org/update`.
- **Rollback risk:** Low.
- **Deps:** D16.

#### D19. No-IP provider

- **Files:** `lib/server/modules/ddns/providers/no-ip.ts` + tests.
- **Behaviour:** HTTPS GET to `dynupdate.no-ip.com` with basic auth.
- **Rollback risk:** Low.
- **Deps:** D16.

#### D20. DDNS schema + repository

- **Files:** `ddns_configs` table — id, provider enum, hostname, credentials encrypted JSON, lastSeenIp nullable, lastUpdateAt nullable, lastError nullable text, enabled bool.
- **Acceptance:** Migration applies; repository CRUD with tests.
- **Rollback risk:** Low.
- **Deps:** A2 (reuse encryption helper).

#### D21. WAN IP poller (scheduled task)

- **Files:** `lib/server/modules/ddns/poller.ts` (new), instrumentation hook.
- **Behaviour:** Every 5 min (configurable env `DDNS_POLL_INTERVAL_MS`, min 60s). Fetch WAN IP from `https://api.ipify.org` (or configurable). For each enabled DDNS config, if WAN IP differs from `lastSeenIp`, call the provider and update the row.
- **Acceptance:** Unit test simulates IP change → provider update → row update.
- **Rollback risk:** Low — failures are logged and surfaced in UI.
- **Deps:** D17–D20.

#### D22. API: `/api/v1/ddns/configs` (CRUD)

- **Files:** Routes + tests.
- **Acceptance:** Auth required. Standard CRUD over the schema in D20.
- **Rollback risk:** Low.
- **Deps:** D20.

#### D23. UI: Settings → Network → DDNS

- **Files:** New section in settings panel.
- **Acceptance:** List configs, add a new one (pick provider → enter creds → enter hostname → enable), see live status and last-updated.
- **Rollback risk:** Low.
- **Deps:** D22.

### Sub-D7 — Polish

#### D24. HTTP→HTTPS redirect toggle

- **Files:** Wire `redirectHttpToHttps` flag from D4 into the Caddy renderer in D6 (already in scope but verify it's exposed in the UI from D13).
- **Acceptance:** Toggle in UI → rule updated → Caddy enforces redirect on next request.
- **Rollback risk:** Low.
- **Deps:** D13.

#### D25. Wildcard subdomain support

- **Files:** Validation in D8 accepts `*.example.com`. Caddy supports wildcards natively for `internal` TLS; ACME-DNS-01 is required for wildcard public certs (out of scope — only support wildcards for internal CA in v1.7).
- **Acceptance:** Wildcard rule routes any subdomain to the configured target. UI labels TLS mode "internal CA — for LAN only" for wildcards.
- **Rollback risk:** Low.
- **Deps:** D8, D13.

#### D26. Cert renewal failure notification

- **Files:** Background task that polls Caddy's cert status every hour; compares to last-known. Notify on `renewal_failed` state.
- **Acceptance:** Manual: revoke a test cert → notification fires.
- **Rollback risk:** Low.
- **Deps:** D10, C6 (reuses notifications service).

#### D27. End-to-end docs

- **Files:** New `doc/modules/proxy.md` covering: required ports (80/443), how to publish them from Docker, Caddy admin API, troubleshooting, DDNS provider setup walkthroughs.
- **Acceptance:** Reviewer (future Claude or human) can follow the doc to set up a working public deployment.
- **Rollback risk:** None — doc only.
- **Deps:** All of Feature D.

**Feature D acceptance:** On a real Pi exposed to the internet (or a port-forwarded test box), one click on "Expose" issues a Let's Encrypt cert and the app becomes reachable via the configured domain on HTTPS. DDNS keeps the domain pointing at the WAN IP across IP changes.

---

## Release-gate: Pi validation matrix

Run before tagging v1.7. Same 8 rows as the original Step 10 above, plus four new rows:

| Scenario | Pass criteria |
|---|---|
| Enable 2FA, log out, log back in via TOTP | Login succeeds; backup codes were displayed once |
| Log in via backup code | Backup code is consumed (single-use) |
| SMART panel on Pi with SSD | Shows real attributes; classification correct |
| Trigger a fake SMART failure | Notification fires exactly once |
| CPU temp shown in System module | Matches `cat /sys/class/thermal/thermal_zone0/temp` reading |
| Create a proxy rule for an installed app via "Expose" | Domain resolves → HTTPS → app reachable |
| Pull the network cable mid-cert-renewal | Cert eventually renews when network returns; no crash |
| DDNS update after WAN IP change | `dig` shows new IP within 5 minutes |

---

## Risks & explicit deferrals (v1.8+)

- **Multi-user 2FA enforcement.** Single-user only in v1.7.
- **DNS-01 ACME challenge.** Wildcard public certs not supported; deferred.
- **HTTP/3 / QUIC in Caddy.** Default Caddy config enables HTTP/2; HTTP/3 left for v1.8.
- **Cert export.** Users can't download Let's Encrypt certs from the UI (Caddy stores them under its data dir; manual access only).
- **Fixing the 65 currently-unauthenticated v1 routes.** Allowlist locked in Step 8; v1.8 starts shrinking it.
- **`applyWebUiPortOverride` 3-part port spec fix.** Still deferred to v1.8.

## Stop-and-ask triggers during execution

Stop the loop and ask the user when:

- A schema change would be non-additive.
- A step needs a new top-level dependency not yet listed.
- Tests fail in a way that suggests the previous step's design is wrong.
- A feature's UI flow conflicts with an existing one (e.g., login screen for 2FA must coexist with the unlock flow).
- Caddy's behaviour differs materially from what this plan assumes (e.g., reload semantics, admin API surface).
