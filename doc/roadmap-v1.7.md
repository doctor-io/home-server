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
