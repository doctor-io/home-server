# Implementation Plan: App Settings Save & Persist

## Overview
Implement full settings save functionality for the App Settings panel, including metadata (name, icon) and configuration (env vars, ports). Metadata saves immediately to DB, configuration changes trigger docker redeploy.

## Architecture Decision

**Single PATCH endpoint approach:**
- `PATCH /api/v1/store/apps/[appId]/settings`
- Accepts: `displayName`, `iconUrl`, `env`, `webUiPort`
- Always saves metadata (name/icon) immediately to `app_stacks` table
- Only triggers redeploy if `env` or `webUiPort` is provided in request
- Returns: `{ saved: true, operationId?: string }`

**UX Flow:**
- Frontend diffs state vs initial → only sends env/port if changed
- Metadata-only change (just rename/icon) → fast DB update, no redeploy
- Config change (env/port) → DB update + docker redeploy operation

## Implementation Layers

### Layer 1: Database Schema

**File:** `db/init.sql`

Add to `app_stacks` CREATE TABLE:
```sql
display_name TEXT,
icon_url TEXT,
```

Add migration for existing installs (after CREATE TABLE):
```sql
ALTER TABLE IF EXISTS app_stacks ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE IF EXISTS app_stacks ADD COLUMN IF NOT EXISTS icon_url TEXT;
```

### Layer 2: Repository

**File:** `lib/server/modules/store/repository.ts`

1. Update `AppStackRow` type:
```typescript
type AppStackRow = {
  // ... existing fields
  display_name: string | null;
  icon_url: string | null;
};
```

2. Update `mapStackRow()`:
```typescript
function mapStackRow(row: AppStackRow): InstalledStackConfig {
  return {
    // ... existing fields
    displayName: row.display_name ?? null,
    iconUrl: row.icon_url ?? null,
  };
}
```

3. Update SELECT queries in:
   - `listInstalledStacksFromDb()` - add `display_name, icon_url` to SELECT
   - `findInstalledStackByAppId()` - add `display_name, icon_url` to SELECT
   - `findStackByWebUiPort()` - add `display_name, icon_url` to SELECT

4. Add new export:
```typescript
export async function patchInstalledStackMeta(
  appId: string,
  input: {
    displayName?: string;
    iconUrl?: string | null;
  }
): Promise<void> {
  // Build dynamic UPDATE with only provided fields
  // UPDATE app_stacks SET display_name = $2, icon_url = $3, updated_at = NOW()
  // WHERE app_id = $1
}
```

### Layer 3: Contracts

**File:** `lib/shared/contracts/apps.ts`

Update `InstalledStackConfig`:
```typescript
export type InstalledStackConfig = {
  // ... existing fields
  displayName: string | null;
  iconUrl: string | null;
};
```

### Layer 4: Service

**File:** `lib/server/modules/store/service.ts`

1. Update `toSummary()` to prefer overrides:
```typescript
function toSummary(...): StoreAppSummary {
  return {
    // ... other fields
    name: installed?.displayName ?? template.name,
    logoUrl: installed?.iconUrl ?? template.logoUrl,
    // ... other fields
  };
}
```

2. Add new export:
```typescript
export async function saveAppSettings(input: {
  appId: string;
  displayName?: string;
  iconUrl?: string | null;
  env?: Record<string, string>;
  webUiPort?: number;
}): Promise<{ operationId?: string }> {
  const { appId, displayName, iconUrl, env, webUiPort } = input;

  // 1. Always save metadata immediately
  if (displayName !== undefined || iconUrl !== undefined) {
    await patchInstalledStackMeta(appId, { displayName, iconUrl });
  }

  // 2. Trigger redeploy if config changed
  if (env !== undefined || webUiPort !== undefined) {
    const result = await startStoreOperation({
      appId,
      action: "redeploy",
      env,
      webUiPort,
    });
    return { operationId: result.operationId };
  }

  return {};
}
```

### Layer 5: API Route

**File:** `app/api/v1/store/apps/[appId]/settings/route.ts` (NEW)

```typescript
import { z } from "zod";
import { saveAppSettings } from "@/lib/server/modules/store/service";
// ... logging imports

const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  iconUrl: z.string().trim().max(500).nullable().optional(),
  env: z.record(z.string(), z.string()).optional(),
  webUiPort: z.number().int().min(1024).max(65535).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ appId: string }> }
) {
  const { appId } = await context.params;
  const requestId = createRequestId();

  try {
    return await withServerTiming({...}, async () => {
      const parsed = settingsSchema.safeParse(await request.json());

      if (!parsed.success) {
        return NextResponse.json({
          error: "Invalid settings payload",
          issues: parsed.error.flatten(),
        }, { status: 400 });
      }

      const result = await saveAppSettings({
        appId,
        ...parsed.data,
      });

      return NextResponse.json({
        saved: true,
        operationId: result.operationId,
      }, { status: 200 });
    });
  } catch (error) {
    // ... error logging
    return NextResponse.json({
      error: "Failed to save app settings",
    }, { status: 500 });
  }
}
```

**File:** `app/api/v1/store/apps/[appId]/settings/__tests__/route.test.ts` (NEW)

Tests:
1. Metadata-only save (name + icon) → 200, no operationId
2. Config save (env + port) → 200, with operationId
3. Combined save (metadata + config) → 200, with operationId
4. Invalid payload → 400 with validation errors
5. Service error → 500

### Layer 6: Frontend Hook

**File:** `hooks/useStoreActions.ts`

Add mutation:
```typescript
const saveSettingsMutation = useMutation({
  mutationFn: async (input: {
    appId: string;
    displayName?: string;
    iconUrl?: string | null;
    env?: Record<string, string>;
    webUiPort?: number;
  }) => {
    const response = await withClientTiming({...}, async () => {
      const result = await fetch(
        `/api/v1/store/apps/${encodeURIComponent(input.appId)}/settings`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: input.displayName,
            iconUrl: input.iconUrl,
            env: input.env,
            webUiPort: input.webUiPort,
          }),
        }
      );

      if (!result.ok) {
        const errorPayload = await parseErrorPayload(result);
        throw new Error(
          toStoreActionErrorMessage(
            `/api/v1/store/apps/${input.appId}/settings`,
            result.status,
            errorPayload
          )
        );
      }

      return await result.json() as { saved: boolean; operationId?: string };
    });

    return { appId: input.appId, ...response };
  },
  onSuccess: ({ appId, operationId }) => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.storeCatalog });
    void queryClient.invalidateQueries({ queryKey: queryKeys.storeApp(appId) });

    if (operationId) {
      void attachOperationTracking({
        appId,
        operationId,
        action: "redeploy",
      });
    }
  },
});
```

Export from hook return:
```typescript
return {
  // ... existing
  saveAppSettings: saveSettingsMutation.mutateAsync,
};
```

### Layer 7: UI Component

**File:** `components/desktop/app-settings-panel.tsx`

Changes:

1. Import dependencies:
```typescript
import { useStoreActions } from "@/hooks/useStoreActions";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
```

2. Add state:
```typescript
const [isSaving, setIsSaving] = useState(false);
const [saveError, setSaveError] = useState<string | null>(null);
```

3. Get hook:
```typescript
const { saveAppSettings } = useStoreActions();
const queryClient = useQueryClient();
```

4. Implement save handler:
```typescript
async function handleSave() {
  if (!appId || isSaving) return;

  setSaveError(null);
  setIsSaving(true);

  try {
    // Build payload
    const payload: {
      appId: string;
      displayName: string;
      iconUrl: string | null;
      env?: Record<string, string>;
      webUiPort?: number;
    } = {
      appId,
      displayName: state.title,
      iconUrl: state.iconUrl || null,
    };

    // Only include env if changed
    const currentEnv = Object.fromEntries(
      state.envVars
        .filter((row) => row.key.trim())
        .map((row) => [row.key, row.value])
    );
    const initialEnv = Object.fromEntries(
      initialState.envVars
        .filter((row) => row.key.trim())
        .map((row) => [row.key, row.value])
    );

    if (JSON.stringify(currentEnv) !== JSON.stringify(initialEnv)) {
      payload.env = currentEnv;
    }

    // Only include port if changed
    const currentPort = state.webUi.port ? parseInt(state.webUi.port, 10) : undefined;
    const initialPort = initialState.webUi.port ? parseInt(initialState.webUi.port, 10) : undefined;

    if (currentPort !== initialPort && currentPort !== undefined) {
      payload.webUiPort = currentPort;
    }

    await saveAppSettings(payload);
    setDidSave(true);
  } catch (error) {
    setSaveError(error instanceof Error ? error.message : "Failed to save settings");
  } finally {
    setIsSaving(false);
  }
}
```

5. Update Save button:
```typescript
<button
  type="button"
  onClick={handleSave}
  disabled={isSaving}
  className="rounded-full bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
>
  {isSaving && <Loader2 className="size-4 animate-spin" />}
  {isSaving ? "Saving..." : "Save"}
</button>
```

6. Show error if present:
```typescript
{saveError && (
  <p className="text-xs text-status-red">{saveError}</p>
)}
```

## Testing Strategy

1. **Unit tests** - `route.test.ts` with mocked service
2. **Manual testing flow:**
   - Install Home Assistant
   - Right-click → App Settings
   - Change only name → Save → verify fast save, no redeploy
   - Change only icon → Save → verify fast save, no redeploy
   - Change port 8123 → 8124 → Save → verify redeploy triggered
   - After redeploy completes → verify app grid shows new name/icon/port
   - Click app icon → verify opens on new port 8124

## Migration Considerations

- **Fresh installs:** Columns created via `db/init.sql` CREATE TABLE
- **Existing installs:** Columns added via ALTER TABLE IF EXISTS ... ADD COLUMN IF NOT EXISTS
- **Fallback:** `mapStackRow` uses `row.display_name ?? null` to gracefully handle missing columns during migration window

## Expected Behavior After Implementation

✅ User changes app name → Save → app grid immediately shows new name
✅ User changes app icon → Save → app grid immediately shows new icon
✅ User changes port 8123 → 8124 → Save → redeploy operation starts → app opens on 8124
✅ User changes env vars → Save → redeploy operation starts → new env applied
✅ User changes name + port → Save → both persist, redeploy operation triggered
✅ Save button shows spinner while saving
✅ Errors display below Save button
✅ After save completes, app grid reflects changes
