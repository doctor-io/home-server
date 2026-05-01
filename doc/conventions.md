# Conventions

This file is the working rulebook for AI agents. Prefer current code patterns over invention, but do not copy known landmines.

## File Naming

- Route files are always `route.ts` under `app/api/**`.
- React component files use kebab-case file names and PascalCase exports, for example `modules/system/components/disk-manager.tsx` exports `DiskManager`.
- Hooks use `useX.ts` or `useX.tsx`, for example `modules/system/hooks/useSystemMetrics.ts`.
- Server modules use kebab-case support files and `service.ts`/`repository.ts` where the local module already follows that shape.

✅ Good:

```tsx
// modules/shell/components/window.tsx
export function Window() {}
```

❌ Bad:

```tsx
// modules/shell/components/WindowComponent.tsx
export function window() {}
```

## Folder Placement

Use `lib/server/modules/X/` for server-side service logic, database repositories, OS/Docker calls, and code that imports secrets or `serverEnv`.

Use `modules/X/` for client feature UI, hooks, reducers, and feature-local view models.

✅ Good:

```ts
// app/api/v1/files/route.ts
import { listDirectory } from "@/lib/server/modules/files/service";
```

❌ Bad:

```tsx
// modules/files/components/file-manager.tsx
import { listDirectory } from "@/lib/server/modules/files/service";
```

## Path Aliases

- `@/lib/server/...`: server-only. Never import from client components or hooks.
- `@/lib/shared/...`: universal contracts, query keys, feature flags.
- `@/lib/ui/...`: client-safe UI helpers and surface tokens.
- `@/modules/...`: feature UI modules.

The alias maps to the repo root in `tsconfig.json`.

## Server-Only Enforcement

Every file under `lib/server/**` must import `"server-only"` at the top. Current good examples include `lib/server/env.ts`, `lib/server/realtime/sse.ts`, and `lib/server/logging/logger.ts`.

✅ Good:

```ts
import "server-only";

import { z } from "zod";
```

❌ Bad:

```ts
import { z } from "zod";
// missing import "server-only"
```

## Contracts Pattern

Client-facing API types live in `lib/shared/contracts/`. The file manager contract is the clearest example: `lib/shared/contracts/files.ts` defines `FileListResponse`, `FileReadResponse`, `FileWriteRequest`, and file error codes used by server routes and client hooks.

✅ Good:

```ts
import type { FileListResponse } from "@/lib/shared/contracts/files";
```

❌ Bad:

```ts
type FileListResponse = { entries: Array<{ name: string }> };
```

When adding an API, add or extend a contract file before wiring the route and hook.

## Query Keys

All TanStack Query keys belong in `lib/shared/query-keys.ts`. Use tuple factories for dynamic keys.

✅ Good:

```ts
export const queryKeys = {
  storeApp: (appId: string) => ["store", "app", appId] as const,
  filesList: (filePath: string, includeHidden = false) =>
    ["files", "list", filePath, includeHidden] as const,
};
```

❌ Bad:

```ts
useQuery({ queryKey: ["store", appId], queryFn });
```

## Error Handling

Domain services should throw domain errors when the caller can map failures to HTTP status codes. `lib/server/modules/files/service.ts` exports `FileServiceError`; `lib/server/modules/network/service.ts` exports `NetworkServiceError`; `lib/server/modules/terminal/service.ts` exports `TerminalServiceError`.

Route handlers catch domain errors and return `{ error, code }` when available. Unexpected errors are logged with `logServerAction()` and returned as a generic 500.

✅ Good:

```ts
if (error instanceof FileServiceError) {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
}
```

❌ Bad:

```ts
return NextResponse.json({ error: String(error) }, { status: 500 });
```

## API Routes

- Versioned application APIs live under `app/api/v1/`.
- Auth bootstrap routes live under `app/api/auth/`.
- Use `export const runtime = "nodejs"` for routes that call Node APIs, Docker, PostgreSQL, or server modules.
- New protected routes must read `getAuthCookieName()` and call `authenticateSession()`.
- Prefer `NextResponse.json({ data })` or `NextResponse.json({ error, code })`.

Current code is inconsistent: `app/api/v1/scheduled-tasks/route.ts` returns `{ tasks }`, while `app/api/v1/files/route.ts` returns `{ data, meta }`. New code should use `{ data }` unless extending an existing route.

✅ Good:

```ts
const sessionToken = request.cookies.get(getAuthCookieName())?.value;
const session = await authenticateSession(sessionToken);
if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

❌ Bad:

```ts
export async function POST() {
  await dangerousSystemMutation();
  return NextResponse.json({ ok: true });
}
```

## SSE

Use `toSseChunk()` from `lib/server/realtime/sse.ts`, send heartbeats with `serverEnv.SSE_HEARTBEAT_MS`, and clean up on `request.signal`.

✅ Good:

```ts
controller.enqueue(encoder.encode(toSseChunk("metrics.updated", snapshot, { id: snapshot.timestamp })));
const heartbeat = setInterval(() => {
  controller.enqueue(encoder.encode(toSseChunk("heartbeat", { timestamp: new Date().toISOString() })));
}, serverEnv.SSE_HEARTBEAT_MS);
request.signal.addEventListener("abort", close);
```

❌ Bad:

```ts
controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
setInterval(sendHeartbeat, 30_000);
```

Known gap: `app/api/v1/system/stream/route.ts`, `app/api/v1/notifications/stream/route.ts`, and other streams currently do not authenticate.

## Server Actions vs API Routes

Follow `CONTRIBUTING.md`: use Server Actions for mutations tied to form submits or direct UI actions; use API routes for client hooks, external callers, SSE, streaming, uploads/downloads, and anything that needs a stable HTTP surface.

## Logging

Use `lib/server/logging/logger.ts`: `createRequestId()`, `logServerAction()`, and `withServerTiming()`. Raw `console.*` exists in `server.ts` and inside the logger, but new feature code should use structured logging.

✅ Good:

```ts
logServerAction({ layer: "api", action: "files.list.get", status: "success", requestId });
```

❌ Bad:

```ts
console.log("files listed", entries);
```

## Environment Variables

Server feature code must read environment through `serverEnv` from `lib/server/env.ts`, which validates with Zod. Do not read `process.env` directly outside entry/config code unless there is a documented reason.

✅ Good:

```ts
import { serverEnv } from "@/lib/server/env";
const root = serverEnv.FILES_ROOT;
```

❌ Bad:

```ts
const root = process.env.FILES_ROOT ?? "/DATA";
```

## Barrel Files

The repo uses few barrel files. `modules/settings/components/panel/sections/index.ts` is a local section export. Do not add wide `index.ts` barrels unless a folder already uses that pattern; direct imports are easier for agents to trace.

## Anti-Patterns To Avoid

- Do not extend files over 500 lines without flagging the refactor risk. Current examples: `lib/server/modules/docker/compose-runner.ts`, `lib/server/modules/apps/operations.ts`, `lib/server/modules/files/service.ts`, `modules/shell/components/desktop-shell.tsx`, `modules/system/components/disk-manager.tsx`.
- Do not add new text-based YAML manipulation in `compose-runner.ts` casually. Prefer narrow helper functions and tests.
- Do not add in-process long-running work without considering operation limits. App operations already use `queueMicrotask()` and have no external queue.
- Do not add new unauthenticated `/api/v1/**` routes unless explicitly public.
- Do not use `any`; ESLint only warns. Prefer `unknown` plus Zod parsing or shared contracts.
- Do not duplicate env file parsing. The audit found parsing in `drizzle.config.ts`, `scripts/db-migrate.ts`, and `compose-runner.ts`.
- `npm run build` now fails on TypeScript errors; keep it that way.
