# Scheduled Tasks

## Purpose

Scheduled tasks run recurring jobs such as shell commands, app restarts, backups, and image pulls. Task definitions and execution history are stored in PostgreSQL.

## Locations

- Server-side: `lib/server/modules/scheduled-tasks/`
- Client-side: `modules/settings/components/panel/sections/scheduled-tasks-section.tsx`, `modules/settings/hooks/useScheduledTasks.ts`
- Routes: `app/api/v1/scheduled-tasks/`

## Key Files

| File | Role |
|---|---|
| `lib/server/modules/scheduled-tasks/service.ts` | CRUD and manual run functions |
| `lib/server/modules/scheduled-tasks/cron.ts` | Cron expression next-run calculation |
| `lib/server/modules/scheduled-tasks/runner.ts` | Runner loop entry |
| `modules/settings/hooks/useScheduledTasks.ts` | Client hook |
| `modules/settings/components/panel/sections/scheduled-tasks-section.tsx` | Settings UI |

## Public API

- `listScheduledTasks()`
- `getScheduledTask()`
- `createScheduledTask()`
- `updateScheduledTask()`
- `deleteScheduledTask()`
- `getDueTasks()`
- `runScheduledTask()`
- `nextCronRun()`
- `startScheduledTaskRunner()`

## Contracts

- `lib/shared/contracts/scheduled-tasks.ts`

## Database Tables

- `scheduled_tasks`
- `scheduled_task_executions`

## API Routes Owned

- `GET /api/v1/scheduled-tasks`
- `POST /api/v1/scheduled-tasks`
- `GET /api/v1/scheduled-tasks/[taskId]`
- `PATCH /api/v1/scheduled-tasks/[taskId]`
- `DELETE /api/v1/scheduled-tasks/[taskId]`
- `POST /api/v1/scheduled-tasks/[taskId]/run`

## Known Issues

- The audit originally inferred this module rather than reading it; current code now contains the module and route tests.
- Task execution is in-process, not a separate worker service.
- Routes in this module do authenticate with `authenticateSession()`.

## How To Extend

To add a new task type:

1. Add the type and Zod schema in `lib/shared/contracts/scheduled-tasks.ts`.
2. Add execution behavior in `lib/server/modules/scheduled-tasks/service.ts`.
3. Update validation and labels in `modules/settings/components/panel/sections/scheduled-tasks-section.tsx`.
4. Add tests for cron calculation, service execution, and route validation.
