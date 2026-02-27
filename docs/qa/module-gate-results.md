# Module Reliability Gate Results

## Module: Files Core + Trash + Shared Folder Convergence
Timestamp: 2026-02-27T21:55:40Z
BASE_URL: http://192.168.1.15

Passed:
- 1. Login flow
- 2. Files core flow (navigate `/DATA`, create folder/file, copy/cut/paste, rename, move to Trash, restore, empty Trash)
- 3.a Files sharing flow (share folder and verify under `/Shared`)

Failed:
- 3.b Files sharing flow (stop sharing)
  - Endpoint: `DELETE /api/v1/files/shared/folders/b0f9317b-e03c-4e64-b2f8-8dc04784c887`
  - Status: `500`
  - Body: `{"error":"Failed to remove shared folder","code":"unmount_failed"}`

Conclusion: FAIL (hard block active)

Notes:
- Current live shared-folder states report `isMounted=false` and `isExported=true`.
- Added a service patch to converge stale local-share cleanup when bind mount is absent and usershare deletion fails, plus tests.
- Patch requires redeploy/restart before rerunning this gate.
