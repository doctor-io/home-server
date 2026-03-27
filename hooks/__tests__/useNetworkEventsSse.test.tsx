/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";
import { useNetworkEventsSse } from "@/modules/system/hooks/useNetworkEventsSse";
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
  beforeEach(() => {
    MockEventSource.instances = [];
    localStorage.clear();
  });

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
        connected: true,
        iface: "wlan0",
        ssid: "HomeNet",
      });
      source.emit("network.device.state.changed", {
        type: "network.device.state.changed",
        connected: true,
        iface: "wlan0",
        ssid: "HomeNet",
      });
      // Duplicate payloads should be deduplicated.
      source.emit("network.connection.changed", {
        type: "network.connection.changed",
        connected: true,
        iface: "wlan0",
        ssid: "HomeNet",
      });
      source.emit("network.device.state.changed", {
        type: "network.device.state.changed",
        connected: true,
        iface: "wlan0",
        ssid: "HomeNet",
      });
      vi.runAllTimers();
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.networkStatus,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.networkNetworks,
    });
    const statusInvalidations = invalidateSpy.mock.calls.filter(
      (call) => call[0]?.queryKey === queryKeys.networkStatus,
    );
    const networksInvalidations = invalidateSpy.mock.calls.filter(
      (call) => call[0]?.queryKey === queryKeys.networkNetworks,
    );
    expect(statusInvalidations).toHaveLength(1);
    expect(networksInvalidations).toHaveLength(1);

    unmount();
    expect(source.close).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("does not connect while a system action is active", () => {
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);
    localStorage.setItem(
      "system.power.action.v1",
      JSON.stringify({
        action: "update",
        startedAt: new Date().toISOString(),
      }),
    );

    const client = createTestQueryClient();

    const { result } = renderHook(() => useNetworkEventsSse(true), {
      wrapper: createWrapper(client),
    });

    expect(result.current.status).toBe("disconnected");
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
