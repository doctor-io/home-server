/* @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/shared/query-keys";
import { useSystemWebSocket } from "@/hooks/useSystemWebSocket";
import { createTestQueryClient, createWrapper } from "@/test/query-client-wrapper";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  send(message: string) {
    this.sent.push(message);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  emitMessage(data: unknown) {
    this.onmessage?.({
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
  }
}

describe("useSystemWebSocket", () => {
  it("initializes websocket and updates query cache from messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    );
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);

    const client = createTestQueryClient();
    const { result, unmount } = renderHook(() => useSystemWebSocket(true), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(MockWebSocket.instances.length).toBe(1);
    });

    const socket = MockWebSocket.instances[0];

    act(() => {
      socket.open();
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
      socket.emitMessage({ type: "metrics.updated", data: payload });
    });

    expect(client.getQueryData(queryKeys.systemMetrics)).toEqual(payload);

    expect(result.current.send("ping")).toBe(true);
    expect(socket.sent).toEqual(["ping"]);

    unmount();
    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
  });

  it("stays idle when disabled", () => {
    const { result } = renderHook(() => useSystemWebSocket(false), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    expect(result.current.status).toBe("idle");
  });
});
