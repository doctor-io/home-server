export const LOCK_STATE_STORAGE_KEY = "desktop.locked.v1";

function parseStoredLockState(rawValue: string | null) {
  return rawValue === "1";
}

export function readLockState(storage: Storage | undefined) {
  if (!storage) return false;

  try {
    return parseStoredLockState(storage.getItem(LOCK_STATE_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function writeLockState(storage: Storage | undefined, isLocked: boolean) {
  if (!storage) return;

  try {
    if (isLocked) {
      storage.setItem(LOCK_STATE_STORAGE_KEY, "1");
      return;
    }

    storage.removeItem(LOCK_STATE_STORAGE_KEY);
  } catch {
    // No-op: lock state persistence is best-effort only.
  }
}
