/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  POWER_ACTION_COMPLETION_STORAGE_KEY,
  POWER_ACTION_STATE_CHANGED_EVENT,
  readPersistedPowerActionCompletion,
  writePersistedPowerActionState,
} from "@/lib/desktop/reboot-state";
import { queryKeys } from "@/lib/shared/query-keys";
import { useRebootRecovery } from "@/modules/shell/hooks/useRebootRecovery";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

const { reloadBrowserWindowMock } = vi.hoisted(() => ({
  reloadBrowserWindowMock: vi.fn(),
}));

vi.mock("@/lib/desktop/browser-reload", () => ({
  reloadBrowserWindow: reloadBrowserWindowMock,
}));

describe("useRebootRecovery", () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
    reloadBrowserWindowMock.mockReset();
  });

  it("recovers from persisted reboot state and clears it after health/auth succeed", async () => {
    writePersistedPowerActionState(localStorage, {
      action: "reboot",
      startedAt: new Date(Date.now() - 10_000).toISOString(),
    });

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useRebootRecovery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.isActive).toBe(true);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, { timeout: 4_000 });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
    }, { timeout: 4_000 });

    expect(localStorage.getItem("system.power.action.v1")).toBeNull();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.currentUser,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.systemMetrics,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.installedApps,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.powerSchedule,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.systemBackups,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.systemUpdates,
    });
  });

  it("clears reboot state on 401 after service recovery", async () => {
    writePersistedPowerActionState(localStorage, {
      action: "factory-reset",
      startedAt: new Date(Date.now() - 20_000).toISOString(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: false, status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();

    const { result } = renderHook(() => useRebootRecovery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
    }, { timeout: 4_000 });

    expect(localStorage.getItem("system.power.action.v1")).toBeNull();
  });

  it("keeps the restore overlay active until health and auth recover", async () => {
    writePersistedPowerActionState(localStorage, {
      action: "restore",
      startedAt: new Date(Date.now() - 10_000).toISOString(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();

    const { result } = renderHook(() => useRebootRecovery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.action).toBe("restore");
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
    }, { timeout: 4_000 });

    expect(localStorage.getItem("system.power.action.v1")).toBeNull();
  });

  it("keeps the update overlay active until health and auth recover", async () => {
    writePersistedPowerActionState(localStorage, {
      action: "update",
      startedAt: new Date(Date.now() - 20_000).toISOString(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();

    const { result } = renderHook(() => useRebootRecovery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.action).toBe("update");
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(false);
    }, { timeout: 4_000 });

    expect(localStorage.getItem("system.power.action.v1")).toBeNull();
    expect(readPersistedPowerActionCompletion(localStorage)).toMatchObject({
      action: "update",
    });
    expect(reloadBrowserWindowMock).toHaveBeenCalledTimes(1);
  });

  it("does not clear update recovery before the service actually goes away", async () => {
    writePersistedPowerActionState(localStorage, {
      action: "update",
      startedAt: new Date().toISOString(),
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockRejectedValueOnce(new Error("gateway down"))
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const client = createTestQueryClient();

    const { result } = renderHook(() => useRebootRecovery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.isActive).toBe(true);
      expect(result.current.action).toBe("update");
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.current.isActive).toBe(true);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(result.current.isActive).toBe(false);
    }, { timeout: 8_000 });

    expect(reloadBrowserWindowMock).toHaveBeenCalledTimes(1);
  });

  it("reacts immediately when a power action is written in the same tab", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("still rebooting")));

    const client = createTestQueryClient();

    const { result } = renderHook(() => useRebootRecovery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
      expect(result.current.isActive).toBe(false);
    });

    act(() => {
      writePersistedPowerActionState(localStorage, {
        action: "update",
        startedAt: new Date().toISOString(),
      });
      window.dispatchEvent(new Event(POWER_ACTION_STATE_CHANGED_EVENT));
    });

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
      expect(result.current.action).toBe("update");
    });
    expect(localStorage.getItem(POWER_ACTION_COMPLETION_STORAGE_KEY)).toBeNull();
  });
});
