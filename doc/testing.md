# Testing

## Current State

Vitest is configured in `vitest.config.ts` with Node as the default environment, V8 coverage, and co-located test discovery for `**/*.test.ts` and `**/*.test.tsx`. `test/setup.ts` mocks `server-only`, `EventSource`, and `window.matchMedia`.

The audit said no real tests were found, but the current working tree contains many route, server module, desktop, shell, and component tests under `__tests__/`. Treat the audit’s “low coverage/no tests” statement as stale for this branch. Coverage still needs to be verified with `npm run test:coverage`.

## Commands

```bash
npm run test
npm run test:watch
npm run test:coverage
npm run lint
```

## Unit Test Pattern: Server Module

Place tests beside the module:

```text
lib/server/modules/files/__tests__/path-resolver.test.ts
lib/server/modules/docker/__tests__/compose-runner.test.ts
```

Use direct imports, mock external process/network boundaries, and verify domain errors rather than string-matching logs.

Example structure:

```ts
import { describe, expect, it } from "vitest";
import { nextCronRun } from "@/lib/server/modules/scheduled-tasks/cron";

describe("nextCronRun", () => {
  it("returns the next run time", () => {
    expect(nextCronRun("0 2 * * *", new Date("2026-05-01T00:00:00Z"))).toBeTruthy();
  });
});
```

## Component Test Pattern

Use React Testing Library for component behavior. Existing examples include `modules/shell/components/__tests__/dock.test.tsx` and page tests under `app/login/__tests__/`.

```ts
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ComponentName", () => {
  it("renders the expected control", () => {
    render(<ComponentName />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

## Route Test Pattern

Route tests live beside route files:

```text
app/api/v1/system/metrics/__tests__/route.test.ts
app/api/v1/store/apps/[appId]/install/__tests__/route.test.ts
```

Import `GET`, `POST`, etc. directly, construct `NextRequest` or `Request`, and mock server services.

## High-Priority Coverage Areas

- `lib/server/modules/docker/compose-runner.ts`: brittle YAML/text transforms and Docker CLI calls.
- `lib/server/modules/apps/operations.ts`: operation state machine, async progress, failure cleanup.
- `lib/server/modules/files/service.ts`: path handling, write conflicts, trash, upload behavior.
- SSE routes: heartbeat, abort cleanup, auth behavior once fixed.
- Auth route brute-force/rate-limit behavior once implemented.
- D-Bus helper protocol: `services/dbus-helper/__tests__/protocol.test.ts` should expand with new helper methods.

## Coverage Targets

Use these as practical targets, not current guarantees:

- Server modules touched by a PR: meaningful unit tests for success and failure paths.
- API routes touched by a PR: route tests for auth, validation, success, and domain errors.
- Risky host actions: tests must cover guardrails and rejected input.
- UI changes: component tests for stateful controls and critical rendering.
