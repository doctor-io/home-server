# API Reference

This reference is generated from the current `app/api/**/route.ts` tree and verified against route exports. Auth means the route currently calls `authenticateSession()` in code; it does not mean the route is safe by design. There is no central middleware.

## Response Conventions

- Preferred success shape for new routes: `{ "data": ... }`.
- Preferred error shape: `{ "error": string, "code"?: string, "details"?: unknown }`.
- Current code is inconsistent. Examples: `app/api/v1/files/route.ts` returns `{ data, meta }`; `app/api/v1/scheduled-tasks/route.ts` returns `{ tasks }`; auth routes use auth-specific shapes.
- Routes that parse JSON generally return `400` for invalid JSON or validation failure.
- Protected routes return `401` when `authenticateSession()` fails.

## Auth Routes

| Method | Path | Auth | Request | Response |
|---|---|---:|---|---|
| `POST` | `/api/auth/login` | N | JSON username/password | session cookie + user/session payload or error |
| `POST` | `/api/auth/logout` | N | session cookie | clears cookie |
| `GET` | `/api/auth/me` | Y | session cookie | current user/session |
| `POST` | `/api/auth/register` | N | JSON username/password | creates first user/session |
| `GET` | `/api/auth/status` | N | none | registration/status payload |
| `POST` | `/api/auth/unlock` | N | JSON password | unlock result |
| `GET` | `/api/health` | N | none | health payload |

## Apps And Store

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `GET` | `/api/v1/apps` | N | List installed apps |
| `POST` | `/api/v1/apps/[appId]/start` | N | Start app stack |
| `POST` | `/api/v1/apps/[appId]/stop` | N | Stop app stack |
| `POST` | `/api/v1/apps/[appId]/restart` | N | Restart app stack |
| `POST` | `/api/v1/apps/[appId]/check-updates` | N | Check one app for updates |
| `GET` | `/api/v1/apps/[appId]/logs/stream` | N ⚠️ | SSE container logs |
| `GET` | `/api/v1/store/apps` | N | List catalog apps |
| `GET` | `/api/v1/store/apps/[appId]` | N | App detail |
| `GET` | `/api/v1/store/apps/[appId]/compose` | N | Compose for catalog/installed app |
| `PATCH` | `/api/v1/store/apps/[appId]/settings` | N | Update stored app settings |
| `POST` | `/api/v1/store/apps/[appId]/install` | N | Start install operation |
| `POST` | `/api/v1/store/apps/[appId]/update` | N | Start update operation |
| `POST` | `/api/v1/store/apps/[appId]/redeploy` | N | Start redeploy operation |
| `POST` | `/api/v1/store/apps/[appId]/uninstall` | N | Start uninstall operation |
| `GET` | `/api/v1/store/operations/[operationId]` | N | Operation snapshot |
| `GET` | `/api/v1/store/operations/[operationId]/stream` | N ⚠️ | SSE operation progress |
| `POST` | `/api/v1/store/check-updates` | N | Check catalog/installed updates |
| `POST` | `/api/v1/store/custom-apps/install` | N | Install custom app |
| `GET` | `/api/v1/store/sources` | N | List catalog sources |
| `POST` | `/api/v1/store/sources` | N | Create catalog source |
| `PATCH` | `/api/v1/store/sources/[sourceId]` | N | Update catalog source |
| `DELETE` | `/api/v1/store/sources/[sourceId]` | N | Delete catalog source |
| `POST` | `/api/v1/store/sources/[sourceId]/refresh` | N | Refresh catalog source |

Contracts: `lib/shared/contracts/apps.ts`, `lib/shared/contracts/docker.ts`. Operation SSE events: `operation.step`, `operation.completed`, `operation.failed`, `heartbeat`.

## Docker

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `GET` | `/api/v1/docker/info` | N | Docker daemon info |
| `GET` | `/api/v1/docker/stats` | N | Container stats snapshot |
| `GET` | `/api/v1/docker/stats/stream` | N ⚠️ | SSE stats stream |
| `POST` | `/api/v1/docker/prune/images` | Y | Prune Docker images |
| `POST` | `/api/v1/docker/prune/volumes` | Y | Prune Docker volumes |

Docker stats SSE events: `stats.updated`, `heartbeat`.

## Files

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `GET` | `/api/v1/files` | N | List directory |
| `GET` | `/api/v1/files/root` | N | File root info |
| `GET` | `/api/v1/files/content` | N | Read file content |
| `PUT` | `/api/v1/files/content` | N | Write text file |
| `GET` | `/api/v1/files/asset` | N | Stream asset content |
| `GET` | `/api/v1/files/download` | N | Download file |
| `POST` | `/api/v1/files/upload` | N | Upload files |
| `POST` | `/api/v1/files/ops` | N | Create/rename/paste/info/star operations |
| `GET` | `/api/v1/files/search` | N | Search files |
| `GET` | `/api/v1/files/starred` | N | List starred files |
| `GET` | `/api/v1/files/zip` | N | Download folder zip |
| `POST` | `/api/v1/files/trash/move` | N | Move entry to trash |
| `POST` | `/api/v1/files/trash/restore` | N | Restore trash entry |
| `POST` | `/api/v1/files/trash/delete` | N | Delete trash entry |
| `POST` | `/api/v1/files/trash/empty` | N | Empty trash |
| `GET` | `/api/v1/files/network/discover/servers` | N | Discover SMB servers |
| `POST` | `/api/v1/files/network/discover/shares` | N | Discover SMB shares |
| `GET` | `/api/v1/files/network/shares` | N | List SMB shares |
| `POST` | `/api/v1/files/network/shares` | N | Add SMB share |
| `DELETE` | `/api/v1/files/network/shares/[shareId]` | N | Remove SMB share |
| `POST` | `/api/v1/files/network/shares/[shareId]/mount` | N | Mount SMB share |
| `POST` | `/api/v1/files/network/shares/[shareId]/unmount` | N | Unmount SMB share |
| `GET` | `/api/v1/files/shared/folders` | N | List local folder shares |
| `POST` | `/api/v1/files/shared/folders` | N | Add local folder share |
| `DELETE` | `/api/v1/files/shared/folders/[shareId]` | N | Remove local folder share |
| `GET` | `/api/v1/files/usb` | N | List USB drives |
| `GET` | `/api/v1/files/usb/stream` | N ⚠️ | SSE USB events |
| `POST` | `/api/v1/files/usb/[driveId]/mount` | N | Mount USB drive |
| `POST` | `/api/v1/files/usb/[driveId]/unmount` | N | Unmount USB drive |
| `POST` | `/api/v1/files/usb/[driveId]/eject` | N | Eject USB drive |
| `GET` | `/api/v1/files/google-drive/auth` | N | Start Google Drive OAuth |
| `GET` | `/api/v1/files/google-drive/callback` | N | OAuth callback |
| `GET` | `/api/v1/files/google-drive/connections` | N | List Drive connections |
| `DELETE` | `/api/v1/files/google-drive/connections/[id]` | N | Delete Drive connection |

Contracts: `lib/shared/contracts/files.ts`, `lib/shared/contracts/usb.ts`. File service errors use `FileServiceErrorCode`.

## Network

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `GET` | `/api/v1/network/status` | N | Network status |
| `GET` | `/api/v1/network/networks` | N | WiFi scan |
| `POST` | `/api/v1/network/connect` | N | Connect WiFi |
| `POST` | `/api/v1/network/disconnect` | N | Disconnect WiFi |
| `GET` | `/api/v1/network/events/stream` | N ⚠️ | SSE network events |

Contract: `lib/shared/contracts/network.ts`.

## Notifications

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `GET` | `/api/v1/notifications` | N | List notifications |
| `DELETE` | `/api/v1/notifications` | N | Clear notifications |
| `POST` | `/api/v1/notifications/read-all` | N | Mark all read |
| `GET` | `/api/v1/notifications/stream` | N ⚠️ | SSE notification events |

Contract: `lib/shared/contracts/notifications.ts`.

## Scheduled Tasks

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `GET` | `/api/v1/scheduled-tasks` | Y | List tasks |
| `POST` | `/api/v1/scheduled-tasks` | Y | Create task |
| `GET` | `/api/v1/scheduled-tasks/[taskId]` | Y | Task detail |
| `PATCH` | `/api/v1/scheduled-tasks/[taskId]` | Y | Update task |
| `DELETE` | `/api/v1/scheduled-tasks/[taskId]` | Y | Delete task |
| `POST` | `/api/v1/scheduled-tasks/[taskId]/run` | Y | Run task now |

Contract: `lib/shared/contracts/scheduled-tasks.ts`.

## Settings And System

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `GET` | `/api/v1/settings/appearance` | N | Appearance settings |
| `PUT` | `/api/v1/settings/appearance` | N | Save appearance settings |
| `GET` | `/api/v1/system/info` | N | Server info |
| `GET` | `/api/v1/system/metrics` | N | Metrics snapshot |
| `GET` | `/api/v1/system/stream` | N ⚠️ | SSE metrics stream |
| `GET` | `/api/v1/system/preferences` | Y | System preferences |
| `PUT` | `/api/v1/system/preferences` | Y | Save system preferences |
| `GET` | `/api/v1/system/security` | Y | Security settings |
| `PUT` | `/api/v1/system/security` | Y | Save security settings |
| `GET` | `/api/v1/system/updates` | Y | Update status |
| `POST` | `/api/v1/system/updates/check` | Y | Check for updates |
| `POST` | `/api/v1/system/updates/apply` | Y | Apply update |
| `GET` | `/api/v1/system/backups` | Y | List backups |
| `POST` | `/api/v1/system/backups/run` | Y | Run backup |
| `PUT` | `/api/v1/system/backups/settings` | Y | Save backup settings |
| `POST` | `/api/v1/system/backups/[backupId]/restore` | Y | Restore backup |
| `GET` | `/api/v1/system/power/capabilities` | Y | Power capabilities |
| `GET` | `/api/v1/system/power/schedule` | Y | Reboot schedule |
| `PUT` | `/api/v1/system/power/schedule` | Y | Save reboot schedule |
| `POST` | `/api/v1/system/power/shutdown` | Y | Shutdown host |
| `POST` | `/api/v1/system/power/reboot` | Y | Reboot host |
| `POST` | `/api/v1/system/power/factory-reset` | Y | Schedule factory reset |
| `GET` | `/api/v1/system/disks` | Y | List disks |
| `POST` | `/api/v1/system/disks/format` | Y | Format partition |
| `POST` | `/api/v1/system/disks/mount` | Y | Mount partition |
| `POST` | `/api/v1/system/disks/unmount` | Y | Unmount partition |
| `POST` | `/api/v1/system/disks/create-partition` | Y | Create partition |
| `POST` | `/api/v1/system/disks/delete-partition` | Y | Delete partition |
| `POST` | `/api/v1/system/disks/wipe` | Y | Wipe disk |
| `GET` | `/api/v1/logs` | N | Read logs |

Contracts: `lib/shared/contracts/system.ts`, `lib/shared/contracts/disks.ts`, `lib/shared/contracts/server-info.ts`.

## Terminal

| Method | Path | Auth | Purpose |
|---|---|---:|---|
| `POST` | `/api/v1/terminal/execute` | N | Execute allowlisted command |
| `WS` | `/api/terminal` | Configured by `TERMINAL_WS_REQUIRE_AUTH` | Full PTY terminal |

WebSocket client-to-server messages in `lib/server/modules/terminal/websocket-server.ts`:

| Message | Shape | Effect |
|---|---|---|
| `input` | `{ "type": "input", "data": string }` | Writes data to PTY |
| `resize` | `{ "type": "resize", "cols"?: number, "rows"?: number }` | Resizes PTY |
| `attach` | `{ "type": "attach", "target": string }` | Switches to `docker exec -it <target> bash`, fallback `sh` |
| `ping` | `{ "type": "ping" }` | Sends `{ "type": "pong" }` |

Server-to-client terminal output is mostly raw PTY bytes as WebSocket text. Error messages can be JSON: `{ "type": "error", "code": string, "message": string }`.

## Known Auth Gaps

⚠️ Current unauthenticated sensitive routes include system metrics streams, notifications, file operations, network operations, store operations, app lifecycle operations, Docker info/stats reads, and terminal execute. See [security.md](./security.md) before exposing a development instance.
