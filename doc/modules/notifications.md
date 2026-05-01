# Notifications

## Purpose

Notifications persist user-visible events in PostgreSQL and stream real-time updates to the UI with SSE. App operations, scheduled task failures, disk warnings, and other system events can create notifications.

## Locations

- Server-side: `lib/server/modules/notifications/`
- Client-side: `modules/system/components/notifications-panel.tsx`, status-bar notification components, `modules/system/hooks/useNotifications.ts`
- Routes: `app/api/v1/notifications/`

## Key Files

| File | Role |
|---|---|
| `lib/server/modules/notifications/service.ts` | List/create/read/clear notifications |
| `lib/server/modules/notifications/emitter.ts` | In-memory SSE pub/sub |
| `app/api/v1/notifications/stream/route.ts` | Notification SSE endpoint |
| `modules/system/hooks/useNotifications.ts` | Client fetching and actions |
| `modules/system/components/notifications-panel.tsx` | Notifications UI |

## Public API

- `listNotifications()`
- `createNotification()`
- `markAllNotificationsRead()`
- `clearAllNotifications()`
- `subscribeToNotifications()`
- `emitNotification()`, `emitNotificationReadAll()`, `emitNotificationCleared()`

## Contracts

- `lib/shared/contracts/notifications.ts`

## Database Tables

- `notifications`

## API Routes Owned

- `GET /api/v1/notifications`
- `DELETE /api/v1/notifications`
- `POST /api/v1/notifications/read-all`
- `GET /api/v1/notifications/stream`

## Known Issues

- SSE pub/sub is in-memory and does not replay events after restart.
- The notification list has a hard cap in service code.
- Notification routes and stream are protected by `requireApiSession()`.
- `toRecord()` in `service.ts` casts DB `kind` values without runtime validation, per the audit.

## How To Extend

To add a new notification producer:

1. Import `createNotification()` in server-side code only.
2. Use an existing `NotificationKind` from `lib/shared/contracts/notifications.ts` or add one there.
3. Add tests for the producer path.
4. If the UI needs filtering/preferences, update `modules/settings/components/panel/sections/notifications-section.tsx` and related settings contracts.
