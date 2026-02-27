/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

const fetchStoreOperationSnapshotMock = vi.fn();
const subscribeToStoreOperationEventsMock = vi.fn();

vi.mock("@/hooks/useStoreOperation", () => ({
  fetchStoreOperationSnapshot: (...args: unknown[]) => fetchStoreOperationSnapshotMock(...args),
  subscribeToStoreOperationEvents: (...args: unknown[]) => subscribeToStoreOperationEventsMock(...args),
}));

import { useStoreActions } from "@/hooks/useStoreActions";

describe("useStoreActions", () => {
  it("starts install lifecycle and invalidates queries on completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ operationId: "op-install-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    fetchStoreOperationSnapshotMock.mockResolvedValue({
      id: "op-install-1",
      appId: "plex",
      action: "install",
      status: "running",
      progressPercent: 10,
      currentStep: "Queued",
      errorMessage: null,
      startedAt: "2026-02-23T10:00:00.000Z",
      finishedAt: null,
      updatedAt: "2026-02-23T10:00:00.000Z",
    });

    let streamHandlers:
      | {
          onEvent?: (payload: {
            operationId: string;
            appId: string;
            action: "install" | "redeploy" | "uninstall";
            status: "queued" | "running" | "success" | "error";
            timestamp: string;
            progressPercent: number;
            step: string;
            message?: string;
          }) => void;
        }
      | undefined;

    const cleanup = vi.fn();
    subscribeToStoreOperationEventsMock.mockImplementation(
      (_operationId: string, options: typeof streamHandlers) => {
        streamHandlers = options;
        return cleanup;
      },
    );

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useStoreActions(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.installApp({
        appId: "plex",
        webUiPort: 32400,
        env: { TZ: "UTC" },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/store/apps/plex/install", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        displayName: undefined,
        env: { TZ: "UTC" },
        webUiPort: 32400,
      }),
    });

    await waitFor(() => {
      expect(result.current.operationsByApp.plex.operationId).toBe("op-install-1");
    });

    act(() => {
      streamHandlers?.onEvent?.({
        operationId: "op-install-1",
        appId: "plex",
        action: "install",
        status: "success",
        timestamp: "2026-02-23T10:00:02.000Z",
        progressPercent: 100,
        step: "Completed",
      });
    });

    await waitFor(() => {
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.storeCatalog });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.installedApps });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.storeApp("plex") });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.storeOperation("op-install-1"),
    });
  });

  it("calls redeploy and uninstall endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ operationId: "op-redeploy-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ operationId: "op-uninstall-1" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    fetchStoreOperationSnapshotMock.mockResolvedValue(null);
    subscribeToStoreOperationEventsMock.mockReturnValue(() => undefined);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStoreActions(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.redeployApp({
        appId: "jellyfin",
        webUiPort: 8096,
        env: { TZ: "UTC" },
      });
      await result.current.uninstallApp({
        appId: "jellyfin",
        removeVolumes: true,
      });
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/v1/store/apps/jellyfin/redeploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        env: { TZ: "UTC" },
        webUiPort: 8096,
      }),
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/v1/store/apps/jellyfin/uninstall", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        removeVolumes: true,
      }),
    });
  });

  it("calls custom install endpoint and tracks operation by returned app id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ appId: "custom-my-app", operationId: "op-custom-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    fetchStoreOperationSnapshotMock.mockResolvedValue({
      id: "op-custom-1",
      appId: "custom-my-app",
      action: "install",
      status: "running",
      progressPercent: 5,
      currentStep: "Queued",
      errorMessage: null,
      startedAt: "2026-02-23T10:00:00.000Z",
      finishedAt: null,
      updatedAt: "2026-02-23T10:00:00.000Z",
    });
    subscribeToStoreOperationEventsMock.mockReturnValue(() => undefined);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStoreActions(), {
      wrapper: createWrapper(client),
    });

    await act(async () => {
      await result.current.installCustomApp({
        name: "My App",
        iconUrl: "https://example.com/icon.png",
        webUiPort: 8088,
        sourceType: "docker-run",
        source: "docker run --name myapp -p 8088:80 nginx:latest",
      });
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/v1/store/custom-apps/install", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "My App",
        iconUrl: "https://example.com/icon.png",
        webUiPort: 8088,
        sourceType: "docker-run",
        source: "docker run --name myapp -p 8088:80 nginx:latest",
      }),
    });

    await waitFor(() => {
      expect(result.current.operationsByApp["custom-my-app"]?.operationId).toBe("op-custom-1");
    });
  });

  it("surfaces API error message and code for install failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "Unable to start install operation",
        code: "helper_unavailable",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    fetchStoreOperationSnapshotMock.mockResolvedValue(null);
    subscribeToStoreOperationEventsMock.mockReturnValue(() => undefined);

    const client = createTestQueryClient();
    const { result } = renderHook(() => useStoreActions(), {
      wrapper: createWrapper(client),
    });

    await expect(
      act(async () => {
        await result.current.installApp({
          appId: "plex",
        });
      }),
    ).rejects.toThrow(
      "Unable to start install operation [helper_unavailable]",
    );
  });

  it(
    "updates operation state from snapshot polling when stream events are missing",
    async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ operationId: "op-install-poll" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      fetchStoreOperationSnapshotMock
        .mockResolvedValueOnce({
          id: "op-install-poll",
          appId: "2fauth",
          action: "install",
          status: "running",
          progressPercent: 1,
          currentStep: "start",
          errorMessage: null,
          startedAt: "2026-02-24T19:00:00.000Z",
          finishedAt: null,
          updatedAt: "2026-02-24T19:00:00.000Z",
        })
        .mockResolvedValueOnce({
          id: "op-install-poll",
          appId: "2fauth",
          action: "install",
          status: "running",
          progressPercent: 85,
          currentStep: "compose-up",
          errorMessage: null,
          startedAt: "2026-02-24T19:00:00.000Z",
          finishedAt: null,
          updatedAt: "2026-02-24T19:00:02.000Z",
        })
        .mockResolvedValueOnce({
          id: "op-install-poll",
          appId: "2fauth",
          action: "install",
          status: "success",
          progressPercent: 100,
          currentStep: "completed",
          errorMessage: null,
          startedAt: "2026-02-24T19:00:00.000Z",
          finishedAt: "2026-02-24T19:00:04.000Z",
          updatedAt: "2026-02-24T19:00:04.000Z",
        });

      const cleanup = vi.fn();
      subscribeToStoreOperationEventsMock.mockReturnValue(cleanup);

      const client = createTestQueryClient();
      const invalidateSpy = vi.spyOn(client, "invalidateQueries");

      const { result } = renderHook(() => useStoreActions(), {
        wrapper: createWrapper(client),
      });

      await act(async () => {
        await result.current.installApp({
          appId: "2fauth",
        });
      });

      await waitFor(() => {
        expect(result.current.operationsByApp["2fauth"]?.progressPercent).toBe(1);
      });

      await waitFor(
        () => {
          expect(result.current.operationsByApp["2fauth"]?.progressPercent).toBe(85);
        },
        { timeout: 4_000 },
      );

      await waitFor(
        () => {
          expect(result.current.operationsByApp["2fauth"]?.status).toBe("success");
          expect(result.current.operationsByApp["2fauth"]?.progressPercent).toBe(100);
        },
        { timeout: 4_000 },
      );

      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.storeCatalog });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.installedApps });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.storeApp("2fauth") });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.storeOperation("op-install-poll"),
      });
    },
    12_000,
  );
});
