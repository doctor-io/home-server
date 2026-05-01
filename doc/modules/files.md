# File Manager

## Purpose

The file manager browses `FILES_ROOT`, reads and writes text files, uploads/downloads files, creates folders, copies/moves/renames entries, manages stars and trash, mounts SMB shares, exports local folders, shows USB drives, and contains early Google Drive integration.

## Locations

- Server-side: `lib/server/modules/files/`
- Client-side: `modules/files/`
- Routes: `app/api/v1/files/`

## Key Files

| File | Role |
|---|---|
| `lib/server/modules/files/service.ts` | Main filesystem service and `FileServiceError` |
| `lib/server/modules/files/path-resolver.ts` | `resolvePathWithinFilesRoot()` path jail |
| `lib/server/modules/files/trash-service.ts` | Trash move/restore/delete |
| `lib/server/modules/files/network-storage.ts` | SMB mount/discovery |
| `lib/server/modules/files/local-sharing.ts` | Local folder sharing |
| `lib/server/modules/files/usb-storage.ts` | USB drive list/mount/unmount/eject |
| `lib/server/modules/files/google-drive.ts` | Google Drive token/connections |
| `modules/files/components/manager/file-manager.tsx` | Main file manager container |
| `modules/files/components/manager/file-manager-state.ts` | Reducer state shape |
| `modules/files/hooks/useFiles.ts` | Main file query/mutation hook |

## Public API

- Server: `listDirectory()`, `readFileForViewer()`, `writeTextFile()`, `uploadFiles()`, `pasteEntry()`, `renameEntry()`, `toggleStarEntry()`, `searchFiles()`
- Client hooks: `useFiles()`, `useNetworkShares()`, `useLocalFolderShares()`, `useTrashActions()`, `useUsbDrives()`, `useGoogleDrive()`
- Components: `FileManager`, `FileManagerSidebar`, `FileManagerToolbar`, `FileManagerView`

## Contracts

- `lib/shared/contracts/files.ts`
- `lib/shared/contracts/usb.ts`

## Database Tables

- `files_network_shares`
- `files_local_shares`
- `files_google_drive_tokens`
- `files_trash_entries`

## API Routes Owned

- `GET /api/v1/files`
- `GET /api/v1/files/root`
- `GET/PUT /api/v1/files/content`
- `GET /api/v1/files/asset`
- `GET /api/v1/files/download`
- `POST /api/v1/files/upload`
- `POST /api/v1/files/ops`
- `GET /api/v1/files/search`
- `GET /api/v1/files/starred`
- `GET /api/v1/files/zip`
- `POST /api/v1/files/trash/*`
- `GET/POST/DELETE /api/v1/files/network/shares*`
- `GET/POST /api/v1/files/network/discover/*`
- `GET/POST/DELETE /api/v1/files/shared/folders*`
- `GET /api/v1/files/usb`
- `GET /api/v1/files/usb/stream`
- `POST /api/v1/files/usb/[driveId]/mount|unmount|eject`
- `GET /api/v1/files/google-drive/*`

## Known Issues

- `lib/server/modules/files/service.ts` is very large.
- `modules/files/components/manager/file-manager-state.ts` has a large state shape.
- The audit found `getCurrentEntries()` in `file-manager-derived.ts` using `unknown[]` parameters.
- File routes are protected by `requireApiSession()`; path jailing remains the main filesystem safety control.

## How To Extend

To add a new file operation:

1. Add request/response types in `lib/shared/contracts/files.ts`.
2. Add server logic to `lib/server/modules/files/service.ts` or a focused file in `lib/server/modules/files/`.
3. Use `resolvePathWithinFilesRoot()` for any host path.
4. Add a route under `app/api/v1/files/`.
5. Add query/mutation support in `modules/files/hooks/files-api.ts` and `useFiles.ts`.
6. Wire UI in `modules/files/components/manager/` or `modules/files/components/dialogs/`.
7. Add server and route tests.
