/* @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";
import { useSystemSse } from "@/hooks/useSystemSse";
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

describe("useSystemSse", () => {
  it("connects to SSE and writes metrics to query cache", () => {
    vi.stubGlobal("EventSource", MockEventSource as unknown as typeof EventSource);

    const client = createTestQueryClient();

    const { result, unmount } = renderHook(() => useSystemSse(true), {
      wrapper: createWrapper(client),
    });

    const eventSource = MockEventSource.instances[0];
    expect(eventSource.url).toBe("/api/v1/system/stream");

    act(() => {
      eventSource.onopen?.(new Event("open"));
    });

    expect(result.current.status).toBe("connected");

    const payload = {
      timestamp: "2026-02-22T12:00:00.000Z",
      hostname: "pi",
      platform: "linux",
      uptimeSeconds: 100,
      cpu: {
        oneMinute: 0.2,
        fiveMinute: 0.1,
        fifteenMinute: 0.1,
        normalizedPercent: 20,
      },
      memory: {
        totalBytes: 1000,
        freeBytes: 500,
        usedBytes: 500,
        usedPercent: 50,
      },
      process: {
        pid: 123,
        uptimeSeconds: 10,
        nodeVersion: "v22",
      },
    };

    act(() => {
      eventSource.emit("metrics.updated", payload);
    });

    expect(client.getQueryData(queryKeys.systemMetrics)).toEqual(payload);

    act(() => {
      eventSource.emit("error", {});
    });

    expect(result.current.status).toBe("disconnected");

    unmount();
    expect(eventSource.close).toHaveBeenCalledTimes(1);
  });
});
