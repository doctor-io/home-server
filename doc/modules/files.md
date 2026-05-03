# File Manager

## Purpose

The file manager browses `FILES_ROOT`, reads and writes text files, streams uploads/downloads, extracts archives, creates folders, copies/moves/renames entries, manages stars and trash, mounts SMB shares, exports local folders, shows USB drives, and integrates Google Drive accounts.

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
| `lib/server/modules/files/google-drive-api.ts` | Google Drive file API operations |
| `lib/server/modules/files/google-oauth-config.ts` | Google OAuth client credential settings |
| `services/upload-server/main.go` | Bare-metal upload sidecar for direct-to-disk uploads |
| `modules/files/components/manager/file-manager.tsx` | Main file manager container |
| `modules/files/components/panels/google-drive-panel.tsx` | Google Drive browser panel |
| `modules/files/components/dialogs/file-manager-dialogs.tsx` | File manager modal dialogs, including upload progress |
| `modules/files/components/manager/file-manager-state.ts` | Reducer state shape |
| `modules/files/hooks/files-api.ts` | Fetch/XHR helpers, including abortable upload |
| `modules/files/hooks/useFiles.ts` | Main file query/mutation hook |

## Public API

- Server: `listDirectory()`, `readFileForViewer()`, `writeTextFile()`, `uploadFiles()`, `pasteEntry()`, `renameEntry()`, `toggleStarEntry()`, `searchFiles()`, `unzipEntry()`
- Client hooks: `useFiles()`, `useNetworkShares()`, `useLocalFolderShares()`, `useTrashActions()`, `useUsbDrives()`, `useGoogleDrive()`, `useGoogleDriveFiles()`, `useUnzipFile()`
- Components: `FileManager`, `FileManagerSidebar`, `FileManagerToolbar`, `FileManagerView`

## Contracts

- `lib/shared/contracts/files.ts`
- `lib/shared/contracts/usb.ts`
- `lib/shared/contracts/google-drive.ts`

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
- `GET/POST/PATCH/DELETE /api/v1/files/google-drive/*`
- `GET/PUT/DELETE /api/v1/settings/google-oauth`

## Known Issues

- `lib/server/modules/files/service.ts` is very large.
- `modules/files/components/manager/file-manager-state.ts` has a large state shape.
- The audit found `getCurrentEntries()` in `file-manager-derived.ts` using `unknown[]` parameters.
- File routes are protected by `requireApiSession()`; path jailing remains the main filesystem safety control.
- Large uploads are stream-parsed by the Next route with `busboy`; bare-metal installs also build the Go upload sidecar at `services/upload-server/main.go`.
- Large uploads still depend on `next.config.mjs` `experimental.proxyClientMaxBodySize: "10gb"` and any external reverse-proxy body-size limits.
- Upload progress is shown in `UploadProgressDialog`; closing the dialog cancels the active XHR through an `AbortController`.
- Google Drive needs Settings → Integrations OAuth credentials before the connect flow can start.

## How To Extend

To add a new file operation:

1. Add request/response types in `lib/shared/contracts/files.ts`.
2. Add server logic to `lib/server/modules/files/service.ts` or a focused file in `lib/server/modules/files/`.
3. Use `resolvePathWithinFilesRoot()` for any host path.
4. Add a route under `app/api/v1/files/`.
5. Add query/mutation support in `modules/files/hooks/files-api.ts` and `useFiles.ts`.
6. Wire UI in `modules/files/components/manager/` or `modules/files/components/dialogs/`.
7. For upload changes, preserve `AbortSignal` cancellation in `uploadFilesToPath()` and avoid reintroducing full-body buffering.
8. For Google Drive changes, update `lib/shared/contracts/google-drive.ts`, query keys, and the Drive panel/hooks together.
9. Add server and route tests.
