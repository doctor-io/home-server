/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";
import { useNetworkEventsSse } from "@/hooks/useNetworkEventsSse";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

class MockEventSource {
  static instances: MockEventSource[] = [];

  onopen: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();
  close = vi.fn();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(listener);
  }

  emit(type: string, payload: unknown) {
    const event = {
      data: typeof payload === "string" ? payload : JSON.stringify(payload),
    } as MessageEvent;

    const listeners = this.listeners.get(type);
    listeners?.forEach((listener) => listener(event));
  }
}

describe("useNetworkEventsSse", () => {
  it("connects to network event stream and invalidates caches on events", () => {
    vi.useFakeTimers();
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result, unmount } = renderHook(() => useNetworkEventsSse(true), {
      wrapper: createWrapper(client),
    });

    const source = MockEventSource.instances[0];
    expect(source.url).toBe("/api/v1/network/events/stream");

    act(() => {
      source.onopen?.(new Event("open"));
    });
    expect(result.current.status).toBe("connected");

    act(() => {
      source.emit("network.connection.changed", {
        type: "network.connection.changed",
      });
      source.emit("network.device.state.changed", {
        type: "network.device.state.changed",
      });
      vi.runAllTimers();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.networkStatus,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.networkNetworks,
    });

    unmount();
    expect(source.close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
