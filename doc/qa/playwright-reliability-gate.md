# Playwright Reliability Gate

This runbook defines a fixed regression flow to execute after each module change.

## Runtime Inputs

- `BASE_URL`
- `E2E_USER`
- `E2E_PASS`

## Fixed Scenario List

1. Login:
   - Open `BASE_URL`.
   - Authenticate with `E2E_USER` / `E2E_PASS`.
   - Verify desktop shell is visible.
2. Files core:
   - Open `Files`.
   - Navigate `/DATA`.
   - Create folder and file.
   - Copy/cut/paste and rename.
   - Move to Trash, restore, and empty Trash.
3. Local folder sharing:
   - Share a folder from context menu.
   - Verify it appears under `/Shared`.
   - Stop sharing and verify removal.
4. Network storage:
   - Open network storage dialog.
   - Verify configured shares list.
   - Mount/unmount/remove one share or validate idempotent remove for unmounted share.
5. App Grid:
   - Open installed app context menu.
   - Trigger `View logs`, `Open in Terminal`, `Open Dashboard`, and `Check Updates`.
6. App settings:
   - Change port/network mode for one installed app.
   - Save and verify value persistence after reopening settings.
   - Verify dashboard opens with updated URL/port.
7. Terminal:
   - Execute commands.
   - Confirm input focus is retained while typing and after command completion.
8. Sidebar/status:
   - Verify `Shared` opens `/Shared`.
   - Verify storage bar shows real metrics text format (`x.x TB / y TB`).
9. Error contract:
   - Trigger known failures and verify stable typed responses:
     - `not_found`
     - `share_exists`
     - `unmount_failed`
     - `permission_denied`

## Pass/Fail Gate

- Hard-block progression on any scenario failure.
- Fix failures and rerun the full scenario list before moving to the next module.

## Evidence Template

Use this structure for each gate run:

```
Module: <module name>
Timestamp: <ISO-8601>
BASE_URL: <url>
Passed:
- <scenario ids>
Failed:
- <scenario id>: <failure summary>
  - Endpoint: <method url>
  - Status: <http status>
  - Body: <response snippet>
  - Screenshot: <path or attachment id>
Conclusion: PASS | FAIL
```
