import { describe, expect, it, vi } from "vitest";
import {
  LOCK_STATE_STORAGE_KEY,
  readLockState,
  writeLockState,
} from "@/lib/desktop/lock-state";

describe("desktop lock state", () => {
  it("reads unlocked by default", () => {
    const getItem = vi.fn().mockReturnValue(null);
    const storage = { getItem } as unknown as Storage;

    expect(readLockState(storage)).toBe(false);
    expect(getItem).toHaveBeenCalledWith(LOCK_STATE_STORAGE_KEY);
  });

  it("reads locked when persisted value is 1", () => {
    const storage = {
      getItem: vi.fn().mockReturnValue("1"),
    } as unknown as Storage;

    expect(readLockState(storage)).toBe(true);
  });

  it("persists and clears lock state", () => {
    const setItem = vi.fn();
    const removeItem = vi.fn();
    const storage = {
      setItem,
      removeItem,
    } as unknown as Storage;

    writeLockState(storage, true);
    expect(setItem).toHaveBeenCalledWith(LOCK_STATE_STORAGE_KEY, "1");

    writeLockState(storage, false);
    expect(removeItem).toHaveBeenCalledWith(LOCK_STATE_STORAGE_KEY);
  });
});
