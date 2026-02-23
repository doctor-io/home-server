import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createConnectionMock = vi.fn();

vi.mock("node:net", () => ({
  default: {
    createConnection: (...args: unknown[]) => createConnectionMock(...args),
  },
}));

import {
  getNetworkStatusFromHelper,
} from "@/lib/server/modules/network/helper-client";
import type { NetworkHelperError } from "@/lib/server/modules/network/helper-client";

class MockSocket extends EventEmitter {
  write = vi.fn((payload: string) => {
    const request = JSON.parse(payload.trim()) as { id: string };
    queueMicrotask(() => {
      this.emit(
        "data",
        Buffer.from(
          `${JSON.stringify({
            id: request.id,
            ok: true,
            result: {
              connected: true,
              iface: "wlan0",
              ssid: "HomeNet",
              ipv4: "192.168.1.12",
              signalPercent: 66,
            },
          })}\n`,
        ),
      );
    });

    return true;
  });

  end = vi.fn();
  destroy = vi.fn(() => {
    this.emit("close");
  });
}

describe("network helper client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encodes helper call and decodes success response", async () => {
    createConnectionMock.mockImplementation(() => {
      const socket = new MockSocket();
      queueMicrotask(() => {
        socket.emit("connect");
      });
      return socket;
    });

    const status = await getNetworkStatusFromHelper({
      requestId: "req-1",
    });

    expect(status.connected).toBe(true);
    expect(status.ssid).toBe("HomeNet");
  });

  it("maps socket unavailable errors to helper_unavailable", async () => {
    createConnectionMock.mockImplementation(() => {
      const socket = new MockSocket();
      queueMicrotask(() => {
        const error = Object.assign(new Error("missing socket"), {
          code: "ENOENT",
        });
        socket.emit("error", error);
      });
      return socket;
    });

    await expect(getNetworkStatusFromHelper()).rejects.toMatchObject({
      code: "helper_unavailable",
      statusCode: 503,
    } satisfies Partial<NetworkHelperError>);
  });
});
