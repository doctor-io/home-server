# Module Reliability Gate Results

## Module: Files Core + Trash + Shared Folder Convergence
Timestamp: 2026-02-27T21:14:29Z
BASE_URL: http://192.168.1.15

Passed:
- 1. Login flow
- 2.a Files core (create folder/file, rename, move to Trash)

Failed:
- 2.b Files core restore from Trash
  - Endpoint: `POST /api/v1/files/trash/restore`
  - Status: `404`
  - Body: `{"error":"File or directory not found","code":"not_found"}`
  - Screenshot: `/Users/ahmedtabib/Code/home-server/docs/qa/module1-restore-fail.png`

Conclusion: FAIL (hard block active)

Notes:
- Reproduced by restoring folder `Trash/e2e-restore-folder`.
- Additional direct API repro from browser context with payload `{ "path": "Trash/e2e-restore-folder", "collision": "keep-both" }` returns same `404 not_found`.
