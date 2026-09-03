import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadPushConfig } = vi.hoisted(() => ({ mockReadPushConfig: vi.fn() }));

vi.mock("@/lib/server/modules/notifications/push-config", () => ({
  readPushConfig: mockReadPushConfig,
  DEFAULT_NTFY_URL: "https://ntfy.sh",
}));

import { dispatchPush, ntfyTransport } from "@/lib/server/modules/notifications/push-service";
import type { NotificationRecord } from "@/lib/shared/contracts/notifications";

const notification: NotificationRecord = {
  id: "n1",
  title: "jellyfin stopped",
  body: "The container exited with code 1",
  kind: "error",
  read: false,
  createdAt: new Date().toISOString(),
};

const configured = {
  enabled: true,
  ntfyUrl: "https://ntfy.sh",
  ntfyTopic: "homeio-abc",
  ntfyToken: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockReadPushConfig.mockResolvedValue(configured);
});

describe("dispatchPush", () => {
  it("sends when push is on and a topic is set", async () => {
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await dispatchPush(notification, transport);

    expect(transport.send).toHaveBeenCalledWith(notification, configured);
  });

  it("stays quiet when push is off", async () => {
    mockReadPushConfig.mockResolvedValue({ ...configured, enabled: false });
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await dispatchPush(notification, transport);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("stays quiet when nothing has been configured to send to", async () => {
    mockReadPushConfig.mockResolvedValue({ ...configured, ntfyTopic: null });
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await dispatchPush(notification, transport);

    expect(transport.send).not.toHaveBeenCalled();
  });

  it("swallows a transport failure", async () => {
    const transport = {
      name: "test",
      send: vi.fn(async () => {
        throw new Error("ntfy is down");
      }),
    };

    // The row is already written and the SSE stream has already fired by the
    // time this runs. An unreachable ntfy must not take down the notification
    // that was trying to report a problem in the first place.
    await expect(dispatchPush(notification, transport)).resolves.toBeUndefined();
  });

  it("swallows a failure to even read the configuration", async () => {
    mockReadPushConfig.mockRejectedValue(new Error("database is unreachable"));
    const transport = { name: "test", send: vi.fn(async () => undefined) };

    await expect(dispatchPush(notification, transport)).resolves.toBeUndefined();
    expect(transport.send).not.toHaveBeenCalled();
  });
});

describe("ntfyTransport", () => {
  function captureFetch(response = { ok: true, status: 200 }) {
    const fetchMock = vi.fn(async () => response as Response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("posts the notification as JSON, not as headers", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, configured);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    // Header values must be Latin-1 and single-line; titles carry unicode and
    // bodies carry newlines, so the payload goes in the body where neither rule
    // applies.
    expect(url).toBe("https://ntfy.sh");
    expect(body).toMatchObject({
      topic: "homeio-abc",
      title: "jellyfin stopped",
      message: "The container exited with code 1",
    });
  });

  it("makes a crash urgent and an info message quiet", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, configured);
    await ntfyTransport.send({ ...notification, kind: "info" }, configured);

    const priorities = fetchMock.mock.calls.map(
      (call) => JSON.parse(String((call[1] as RequestInit).body)).priority,
    );

    // A stopped container should wake someone; a routine message should not.
    expect(priorities[0]).toBe(5);
    expect(priorities[1]).toBe(2);
  });

  it("carries a token only when one is configured", async () => {
    const withToken = captureFetch();
    await ntfyTransport.send(notification, { ...configured, ntfyToken: "tk_secret" });
    const authed = (withToken.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(authed.Authorization).toBe("Bearer tk_secret");

    const withoutToken = captureFetch();
    await ntfyTransport.send(notification, configured);
    const anonymous = (withoutToken.mock.calls[0][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(anonymous.Authorization).toBeUndefined();
  });

  it("trims a trailing slash off a self-hosted URL", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, {
      ...configured,
      ntfyUrl: "https://ntfy.example.com/",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://ntfy.example.com");
  });

  it("treats a non-2xx answer as a failure", async () => {
    captureFetch({ ok: false, status: 403 });

    await expect(ntfyTransport.send(notification, configured)).rejects.toThrow("403");
  });

  it("does nothing at all without a topic", async () => {
    const fetchMock = captureFetch();

    await ntfyTransport.send(notification, { ...configured, ntfyTopic: null });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
