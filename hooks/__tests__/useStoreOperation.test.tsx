/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  fetchStoreOperationSnapshot,
  subscribeToStoreOperationEvents,
  useStoreOperation,
} from "@/hooks/useStoreOperation";
import { queryKeys } from "@/lib/shared/query-keys";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

type Listener = (event: { data: string }) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  listeners = new Map<string, Set<Listener>>();
  closed = false;

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, payload: unknown) {
    const serialized = JSON.stringify(payload);
    this.listeners.get(type)?.forEach((listener) => {
      listener({ data: serialized });
    });
  }

  emitRaw(type: string, data: string) {
    this.listeners.get(type)?.forEach((listener) => {
      listener({ data });
    });
  }
}

describe("useStoreOperation", () => {
  it("fetches operation snapshot and merges stream events", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "op-1",
          appId: "plex",
          action: "install",
          status: "running",
          progressPercent: 15,
          currentStep: "Pulling images",
          errorMessage: null,
          startedAt: "2026-02-23T10:00:00.000Z",
          finishedAt: null,
          updatedAt: "2026-02-23T10:00:00.000Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result, unmount } = renderHook(() => useStoreOperation("op-1"), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(result.current.operation?.status).toBe("running");
    });

    const source = MockEventSource.instances[0];
    expect(source.url).toBe("/api/v1/store/operations/op-1/stream");

    act(() => {
      source.emit("operation.pull.progress", {
        type: "operation.pull.progress",
        operationId: "op-1",
        appId: "plex",
        action: "install",
        status: "running",
        timestamp: "2026-02-23T10:00:02.000Z",
        progressPercent: 45,
        step: "Pulling layer",
      });
    });

    await waitFor(() => {
      expect(result.current.operation?.progressPercent).toBe(45);
      expect(result.current.operation?.currentStep).toBe("Pulling layer");
    });

    act(() => {
      source.emit("operation.completed", {
        type: "operation.completed",
        operationId: "op-1",
        appId: "plex",
        action: "install",
        status: "success",
        timestamp: "2026-02-23T10:00:03.000Z",
        progressPercent: 100,
        step: "Completed",
      });
    });

    await waitFor(() => {
      expect(result.current.operation?.status).toBe("success");
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.storeCatalog });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.installedApps });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.storeApp("plex") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.storeOperation("op-1") });

    unmount();
    expect(source.closed).toBe(true);
  });

  it("returns null when operation snapshot is not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }),
    );

    const data = await fetchStoreOperationSnapshot("missing");
    expect(data).toBeNull();
  });

  it("calls onError when stream event payload is invalid", () => {
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    const onEvent = vi.fn();
    const onError = vi.fn();

    const unsubscribe = subscribeToStoreOperationEvents("op-2", {
      onEvent,
      onError,
    });

    const source = MockEventSource.instances.at(-1);
    if (!source) {
      throw new Error("Expected EventSource instance");
    }

    source.emitRaw("operation.step", "{invalid");

    expect(onEvent).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(source.closed).toBe(true);
  });
});
