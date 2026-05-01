# System

## Purpose

The system module exposes metrics, Docker info/stats, server info, updates, backups, power controls, disk management, weather widgets, and status bar data.

## Locations

- Server-side: `lib/server/modules/system/`, plus Docker/network modules for some data
- Client-side: `modules/system/`, settings sections under `modules/settings/`
- Routes: `app/api/v1/system/`, `app/api/v1/docker/`, `app/api/v1/logs`

## Key Files

| File | Role |
|---|---|
| `lib/server/modules/system/service.ts` | Metrics snapshot collection |
| `lib/server/modules/system/info-service.ts` | Server info |
| `lib/server/modules/system/update-service.ts` | Update status/apply |
| `lib/server/modules/system/backup-service.ts` | Backup settings/list/run |
| `lib/server/modules/system/power-service.ts` | Shutdown/reboot/factory reset |
| `lib/server/modules/system/disk-service.ts` | Disk and partition operations |
| `modules/system/hooks/useSystemSse.ts` | Metrics SSE client |
| `modules/system/components/monitor.tsx` | System monitor UI |
| `modules/system/components/disk-manager.tsx` | Disk manager UI |

## Public API

- `getSystemMetricsSnapshot()`
- `getSystemUpdateStatus()`, `scheduleSystemUpdate()`
- `getSystemBackupsSnapshot()`, `runSystemBackupNow()`
- `scheduleSystemReboot()`, `scheduleSystemShutdown()`, `scheduleFactoryReset()`
- `listDisks()`, `formatPartition()`, `mountPartition()`, `unmountPartition()`
- Client hooks: `useSystemMetrics()`, `useSystemSse()`, `useDockerInfo()`, `useDockerStats()`, `useDisks()`, `useServerInfo()`

## Contracts

- `lib/shared/contracts/system.ts`
- `lib/shared/contracts/disks.ts`
- `lib/shared/contracts/server-info.ts`
- `lib/shared/contracts/weather.ts`

## Database Tables

- `settings` for appearance/system settings stored as JSON
- Backup metadata is file-backed through the backup service, not a dedicated table in `schema.ts`.

## API Routes Owned

- `GET /api/v1/system/metrics`
- `GET /api/v1/system/stream`
- `GET /api/v1/system/info`
- `GET/PUT /api/v1/system/preferences`
- `GET/PUT /api/v1/system/security`
- `GET /api/v1/system/updates`
- `POST /api/v1/system/updates/check`
- `POST /api/v1/system/updates/apply`
- `GET/POST/PUT /api/v1/system/backups*`
- `GET/POST /api/v1/system/power/*`
- `GET/POST /api/v1/system/disks*`
- `GET /api/v1/logs`

## Known Issues

- `app/api/v1/system/stream/route.ts` authenticates before opening the SSE stream.
- Some metrics cache TTL constants are hardcoded in `lib/server/modules/system/service.ts`.
- `modules/system/components/disk-manager.tsx` is over 500 lines.
- Power and disk routes are high-risk because they perform destructive host actions.

## How To Extend

To add a system setting:

1. Add contract fields in `lib/shared/contracts/system.ts`.
2. Add persistence/default logic in `lib/server/modules/system/preferences-service.ts` or the relevant service.
3. Add or update a route under `app/api/v1/system/`.
4. Add request helpers in `modules/settings/hooks/backend/api.ts`.
5. Add controller state in `modules/settings/components/panel/controllers.ts`.
6. Add UI in the relevant settings section.
7. Add tests for service, route, and save-policy helpers.
